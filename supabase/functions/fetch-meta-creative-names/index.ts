import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaAd {
  id: string;
  name: string;
  status: string;
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

/** Fetch every ad (any status) from the account, following pagination. */
async function fetchAllAds(accessToken: string, adAccountId: string): Promise<MetaAd[]> {
  const ads: MetaAd[] = [];
  const effectiveStatus = encodeURIComponent(JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED"]));
  let url: string | null =
    `https://graph.facebook.com/v19.0/${adAccountId}/ads` +
    `?fields=id,name,status&effective_status=${effectiveStatus}` +
    `&limit=500&access_token=${accessToken}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(JSON.stringify(data.error));
    }

    for (const ad of data.data ?? []) {
      ads.push({ id: ad.id, name: ad.name, status: ad.status });
    }

    url = data.paging?.next ?? null;
  }

  return ads;
}

/** Fetch spend per ad over the last 30 days, following pagination. Returns a map ad_id -> spend. */
async function fetchSpendByAd(accessToken: string, adAccountId: string): Promise<Record<string, number>> {
  const spendByAd: Record<string, number> = {};
  let url: string | null =
    `https://graph.facebook.com/v19.0/${adAccountId}/insights` +
    `?level=ad&fields=ad_id,spend&date_preset=last_30d` +
    `&limit=500&access_token=${accessToken}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(JSON.stringify(data.error));
    }

    for (const row of data.data ?? []) {
      if (row.ad_id) spendByAd[row.ad_id] = parseFloat(row.spend) || 0;
    }

    url = data.paging?.next ?? null;
  }

  return spendByAd;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("META_ACCESS_TOKEN");
    const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID");

    if (!accessToken || !adAccountId) {
      return new Response(
        JSON.stringify({ error: "META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let spendError: string | null = null;
    const [ads, spendByAd] = await Promise.all([
      fetchAllAds(accessToken, adAccountId),
      fetchSpendByAd(accessToken, adAccountId).catch((e) => {
        spendError = e instanceof Error ? e.message : String(e);
        console.warn("[Meta-Creative-Names] Spend fetch failed, continuing without it:", e);
        return {} as Record<string, number>;
      }),
    ]);

    const sb = getSupabase();
    const rows = ads.map((ad) => ({
      ad_id: ad.id,
      ad_name: ad.name,
      ad_status: ad.status,
      spend_last_30d: spendByAd[ad.id] ?? null,
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await sb.from("meta_creative_cache").upsert(batch, { onConflict: "ad_id" });
      if (error) console.warn("[Meta-Creative-Names] Cache upsert error:", error.message);
    }

    return new Response(
      JSON.stringify({ updated: rows.length, spendError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[Meta-Creative-Names] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
