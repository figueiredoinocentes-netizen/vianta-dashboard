import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InsightRow {
  date: string;
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  cpm: number | null;
  ctr: number | null;
  clicks: number | null;
  spend: number | null;
  landing_page_views: number | null;
  leads: number | null;
  cost_per_lead: number | null;
  updated_at: string;
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

function sumActions(actions: any[] | undefined, predicate: (t: string) => boolean): number | null {
  if (!Array.isArray(actions)) return null;
  let total = 0;
  let found = false;
  for (const a of actions) {
    if (a && typeof a.action_type === "string" && predicate(a.action_type)) {
      const v = parseFloat(a.value);
      if (!isNaN(v)) {
        total += v;
        found = true;
      }
    }
  }
  return found ? total : null;
}

function pickCostPerAction(
  costs: any[] | undefined,
  predicate: (t: string) => boolean,
): number | null {
  if (!Array.isArray(costs)) return null;
  for (const c of costs) {
    if (c && typeof c.action_type === "string" && predicate(c.action_type)) {
      const v = parseFloat(c.value);
      if (!isNaN(v)) return v;
    }
  }
  return null;
}

async function fetchAllInsights(
  accessToken: string,
  adAccountId: string,
  datePreset: string,
): Promise<{ rows: InsightRow[]; actionTypes: Record<string, number> }> {
  const rows: InsightRow[] = [];
  const actionTypes: Record<string, number> = {};
  const fields = [
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "impressions",
    "reach",
    "frequency",
    "cpm",
    "ctr",
    "clicks",
    "inline_link_clicks",
    "inline_link_click_ctr",
    "spend",
    "actions",
    "cost_per_action_type",
    "date_start",
  ].join(",");

  let url: string | null =
    `https://graph.facebook.com/v19.0/${adAccountId}/insights` +
    `?level=ad&time_increment=1&date_preset=${encodeURIComponent(datePreset)}` +
    `&fields=${fields}&limit=500&access_token=${accessToken}`;

  const now = new Date().toISOString();

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));

    for (const r of data.data ?? []) {
      if (!r.ad_id || !r.date_start) continue;

      if (Array.isArray(r.actions)) {
        for (const a of r.actions) {
          if (a?.action_type) actionTypes[a.action_type] = (actionTypes[a.action_type] ?? 0) + 1;
        }
      }

      // Try "lead" first, then fallbacks
      let leads = sumActions(r.actions, (t) => t === "lead");
      if (leads === null) {
        leads = sumActions(r.actions, (t) => LEAD_ACTION_TYPES.has(t));
      }
      const landing_page_views = sumActions(r.actions, (t) => t === "landing_page_view");

      let cost_per_lead = pickCostPerAction(r.cost_per_action_type, (t) => t === "lead");
      if (cost_per_lead === null) {
        cost_per_lead = pickCostPerAction(r.cost_per_action_type, (t) => LEAD_ACTION_TYPES.has(t));
      }
      const spend = r.spend != null ? parseFloat(r.spend) : null;
      if (cost_per_lead === null && leads && leads > 0 && spend != null) {
        cost_per_lead = spend / leads;
      }

      rows.push({
        date: r.date_start,
        ad_id: r.ad_id,
        ad_name: r.ad_name ?? null,
        adset_id: r.adset_id ?? null,
        adset_name: r.adset_name ?? null,
        campaign_id: r.campaign_id ?? null,
        campaign_name: r.campaign_name ?? null,
        impressions: r.impressions != null ? parseInt(r.impressions) : null,
        reach: r.reach != null ? parseInt(r.reach) : null,
        frequency: r.frequency != null ? parseFloat(r.frequency) : null,
        cpm: r.cpm != null ? parseFloat(r.cpm) : null,
        ctr: r.inline_link_click_ctr != null ? parseFloat(r.inline_link_click_ctr) : null,
        clicks: r.inline_link_clicks != null ? parseInt(r.inline_link_clicks) : null,
        spend,
        landing_page_views,
        leads,
        cost_per_lead,
        updated_at: now,
      });
    }

    url = data.paging?.next ?? null;
  }

  return { rows, actionTypes };
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

    let datePreset = "last_30d";
    if (req.method !== "GET") {
      try {
        const body = await req.json();
        if (body?.datePreset && typeof body.datePreset === "string") {
          datePreset = body.datePreset;
        }
      } catch (_) {
        // no body
      }
    }

    let insightsError: string | null = null;
    let rows: InsightRow[] = [];
    let actionTypes: Record<string, number> = {};
    try {
      const result = await fetchAllInsights(accessToken, adAccountId, datePreset);
      rows = result.rows;
      actionTypes = result.actionTypes;
    } catch (e) {
      insightsError = e instanceof Error ? e.message : String(e);
      console.error("[Meta-Insights] Fetch failed:", e);
      return new Response(
        JSON.stringify({ updated: 0, insightsError, actionTypes: {} }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = getSupabase();
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await sb
        .from("meta_insights_daily")
        .upsert(batch, { onConflict: "date,ad_id" });
      if (error) console.warn("[Meta-Insights] Upsert error:", error.message);
    }

    return new Response(
      JSON.stringify({ updated: rows.length, insightsError, actionTypes, datePreset }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[Meta-Insights] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
