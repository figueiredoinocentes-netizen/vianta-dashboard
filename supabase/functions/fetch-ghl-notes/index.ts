import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const MAX_CONCURRENCY = 3; // 3 concurrent workers with 400ms delay ≈ ~4 req/s
const MAX_CONTACTS = 500;
const REQUEST_DELAY_MS = 400; // 400ms between requests per worker
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface GHLNote {
  id: string;
  body: string;
  dateAdded?: string;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      const wait = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.warn(`[GHL-Notes] 429 rate limited, waiting ${wait}ms (attempt ${attempt + 1})`);
      await delay(wait);
      continue;
    }
    return res;
  }
  return fetch(url, { headers });
}

async function fetchNotesForContact(
  contactId: string,
  apiKey: string,
): Promise<{ contactId: string; notes: GHLNote[]; status?: number }> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-07-28",
    Accept: "application/json",
  };

  try {
    // GHL notes endpoint does NOT accept limit/offset params
    const url = `${GHL_BASE}/contacts/${contactId}/notes`;
    const res = await fetchWithRetry(url, headers);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[GHL-Notes] Error ${res.status} for contact ${contactId}: ${body}`);
      return { contactId, notes: [], status: res.status };
    }

    const data = await res.json();
    const notes: GHLNote[] = (data.notes || []).map((n: any) => ({
      id: n.id,
      body: n.body || "",
      dateAdded: n.dateAdded || null,
    }));

    return { contactId, notes, status: 200 };
  } catch (e) {
    console.error(`[GHL-Notes] Exception for contact ${contactId}:`, e);
    return { contactId, notes: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GHL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GHL_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { contactIds, forceRefresh, mode } = await req.json();
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return new Response(
        JSON.stringify({ notes: {}, cached: false, totalRequested: 0, cachedCount: 0, fetchedCount: 0, missingCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalRequested = contactIds.length;
    const sb = getSupabase();
    const isBackfill = mode === "backfill";

    // Get ALL existing cache entries for the requested contacts (regardless of TTL)
    // IMPORTANT: chunk the .in() query — PostgREST/URL limits truncate large IN clauses silently
    const allCached: Array<{ contact_id: string; notes: any; fetched_at: string }> = [];
    const CHUNK = 150;
    for (let i = 0; i < contactIds.length; i += CHUNK) {
      const slice = contactIds.slice(i, i + CHUNK);
      const { data, error } = await sb
        .from("ghl_notes_cache")
        .select("contact_id, notes, fetched_at")
        .in("contact_id", slice);
      if (error) {
        console.warn(`[GHL-Notes] Cache read error chunk ${i}:`, error.message);
        continue;
      }
      if (data) allCached.push(...(data as any));
    }

    const cachedMap: Record<string, GHLNote[]> = {};
    const cachedIdSet = new Set<string>();
    let oldestFetch = new Date().toISOString();

    if (allCached) {
      for (const row of allCached) {
        cachedIdSet.add(row.contact_id);
        const notes = row.notes as GHLNote[];
        if (notes && notes.length > 0) cachedMap[row.contact_id] = notes;
        if (row.fetched_at < oldestFetch) oldestFetch = row.fetched_at;
      }
    }

    // Determine which IDs need fetching
    const uncachedIds = contactIds.filter((id: string) => !cachedIdSet.has(id));

    let toFetch: string[];
    if (isBackfill) {
      // Backfill mode: only process contacts WITHOUT any cache, ignore forceRefresh
      toFetch = uncachedIds.slice(0, MAX_CONTACTS);
    } else if (forceRefresh) {
      // Force refresh: re-fetch all up to limit
      toFetch = contactIds.slice(0, MAX_CONTACTS);
    } else {
      // Normal: fetch uncached + expired, prioritize uncached
      const cutoff = Date.now() - CACHE_TTL_MS;
      const expiredIds: string[] = [];
      if (allCached) {
        for (const row of allCached) {
          if (new Date(row.fetched_at).getTime() < cutoff) expiredIds.push(row.contact_id);
        }
      }
      toFetch = [...uncachedIds, ...expiredIds].slice(0, MAX_CONTACTS);
    }

    let fetchedCount = 0;
    if (toFetch.length > 0) {
      console.log(`[GHL-Notes] mode=${isBackfill ? "backfill" : "normal"} cached=${cachedIdSet.size} fetching=${toFetch.length} of total=${totalRequested}`);
      const freshNotes = await fetchContactsBatch(toFetch, apiKey);

      if (freshNotes === null) {
        return new Response(
          JSON.stringify({ notes: cachedMap, authError: true, error: "Token GHL sem permissão para notas.", totalRequested, cachedCount: Object.keys(cachedMap).length, fetchedCount: 0, missingCount: totalRequested - cachedIdSet.size }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await saveToCacheAll(sb, freshNotes);
      fetchedCount = Object.keys(freshNotes).length;

      // Merge fresh into result
      for (const [cid, notes] of Object.entries(freshNotes)) {
        cachedIdSet.add(cid);
        if (notes.length > 0) cachedMap[cid] = notes;
      }
    } else {
      console.log(`[GHL-Notes] All ${totalRequested} contacts served from cache`);
    }

    const missingCount = totalRequested - cachedIdSet.size;

    return new Response(
      JSON.stringify({
        notes: cachedMap,
        cached: fetchedCount === 0,
        cachedAt: fetchedCount === 0 ? oldestFetch : new Date().toISOString(),
        totalRequested,
        cachedCount: cachedIdSet.size,
        fetchedCount,
        missingCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[GHL-Notes] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/** Fetch notes for a batch of contacts. Returns null on auth error. */
async function fetchContactsBatch(
  ids: string[],
  apiKey: string,
): Promise<Record<string, GHLNote[]> | null> {
  if (ids.length === 0) return {};

  const firstResult = await fetchNotesForContact(ids[0], apiKey);
  if (firstResult.status === 401) {
    console.error("[GHL-Notes] 401 — aborting batch.");
    return null;
  }

  const remainingIds = ids.slice(1);
  const remainingResults: (typeof firstResult)[] = [];
  let idx = 0;

  async function worker() {
    while (idx < remainingIds.length) {
      const currentIdx = idx++;
      remainingResults[currentIdx] = await fetchNotesForContact(remainingIds[currentIdx], apiKey);
      await delay(REQUEST_DELAY_MS);
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, remainingIds.length) },
    () => worker(),
  );
  await Promise.all(workers);

  const result: Record<string, GHLNote[]> = {};
  result[firstResult.contactId] = firstResult.notes;
  for (const r of remainingResults) {
    if (r) result[r.contactId] = r.notes;
  }
  return result;
}

/** Upsert notes into cache table */
async function saveToCacheAll(
  sb: ReturnType<typeof createClient>,
  notesMap: Record<string, GHLNote[]>,
) {
  const rows = Object.entries(notesMap).map(([contact_id, notes]) => ({
    contact_id,
    notes, // pass as object, supabase-js serializes to jsonb
    fetched_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return;

  // Upsert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await sb
      .from("ghl_notes_cache")
      .upsert(batch, { onConflict: "contact_id" });
    if (error) console.warn("[GHL-Notes] Cache upsert error:", error.message);
  }
}
