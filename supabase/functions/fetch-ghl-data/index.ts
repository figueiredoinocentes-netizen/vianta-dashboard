import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GHL_BASE = "https://services.leadconnectorhq.com";

interface GHLStageRaw {
  id: string;
  name: string;
  position: number;
}

interface GHLPipelineRaw {
  id: string;
  name: string;
  stages: GHLStageRaw[];
}

interface GHLContact {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface GHLOpportunity {
  id: string;
  name?: string;
  pipelineStageId: string;
  monetaryValue?: number;
  status?: string;
  contact?: GHLContact;
  contactId?: string;
}

interface GHLSearchResponse {
  opportunities: GHLOpportunity[];
  meta?: {
    total?: number;
    startAfterId?: string;
    startAfter?: number;
    currentPage?: number;
    nextPage?: number | null;
    previousPage?: number | null;
  };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 250; // max ~4 req/s to stay under GHL 5 req/s

async function ghlFetch(path: string, apiKey: string): Promise<Response> {
  // Throttle requests globally
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await delay(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestTime = Date.now();

  const url = `${GHL_BASE}${path}`;
  console.log(`[GHL] Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
  });

  // Auto-retry on 429
  if (res.status === 429) {
    console.warn(`[GHL] 429 rate limited, waiting 2s and retrying...`);
    await delay(2000);
    lastRequestTime = Date.now();
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    });
  }

  return res;
}

async function fetchPipelines(apiKey: string, locationId: string): Promise<GHLPipelineRaw[]> {
  const res = await ghlFetch(`/opportunities/pipelines?locationId=${locationId}`, apiKey);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[GHL] Pipelines error ${res.status}: ${body}`);
    if (res.status === 401) throw new Error("GHL_AUTH_ERROR: Token inválido ou expirado");
    if (res.status === 429) throw new Error("GHL_RATE_LIMIT: Demasiados pedidos, tenta mais tarde");
    throw new Error(`GHL API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  console.log(`[GHL] Found ${data.pipelines?.length ?? 0} pipelines`);
  return data.pipelines || [];
}

async function fetchAllOpportunities(
  apiKey: string,
  locationId: string,
  pipelineId: string
): Promise<GHLOpportunity[]> {
  const allOpps: GHLOpportunity[] = [];
  let startAfterId: string | undefined;
  let startAfter: number | undefined;
  let page = 0;
  const MAX_PAGES = 100;

  while (true) {
    page++;
    let path = `/opportunities/search?location_id=${locationId}&pipeline_id=${pipelineId}&limit=100`;
    if (startAfterId) {
      path += `&startAfterId=${startAfterId}`;
    }
    if (startAfter !== undefined) {
      path += `&startAfter=${startAfter}`;
    }

    const res = await ghlFetch(path, apiKey);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[GHL] Opportunities error ${res.status} (page ${page}): ${body}`);
      if (res.status === 401) throw new Error("GHL_AUTH_ERROR: Token inválido ou expirado");
      if (res.status === 429) throw new Error("GHL_RATE_LIMIT: Demasiados pedidos, tenta mais tarde");
      throw new Error(`GHL API error ${res.status}: ${body}`);
    }

    const data: GHLSearchResponse = await res.json();
    const opps = data.opportunities || [];
    console.log(`[GHL] Pipeline ${pipelineId} page ${page}: ${opps.length} opps (total: ${data.meta?.total ?? '?'})`);

    allOpps.push(...opps);

    // Check if there are more pages using meta
    if (opps.length < 100) break;
    if (!data.meta?.startAfterId) break;
    if (data.meta?.nextPage === null) break;

    // Use pagination cursors from response meta
    startAfterId = data.meta.startAfterId;
    startAfter = data.meta.startAfter;

    if (page >= MAX_PAGES) {
      console.warn(`[GHL] Pipeline ${pipelineId}: reached max pagination limit (${MAX_PAGES} pages)`);
      break;
    }
  }

  console.log(`[GHL] Total opportunities for pipeline ${pipelineId}: ${allOpps.length}`);
  return allOpps;
}

interface EnrichedOpportunity {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stageName: string;
  pipelineName: string;
  monetaryValue: number;
  status: string;
}

function processPipelineData(pipeline: GHLPipelineRaw, opportunities: GHLOpportunity[]) {
  const sortedStages = [...pipeline.stages].sort((a, b) => a.position - b.position);

  const pipelineData = {
    id: pipeline.id,
    name: pipeline.name,
    stages: sortedStages.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
    })),
  };

  const stageMap = new Map<string, { count: number; monetaryValue: number }>();
  const stageNameMap = new Map<string, string>();
  for (const stage of sortedStages) {
    stageMap.set(stage.id, { count: 0, monetaryValue: 0 });
    stageNameMap.set(stage.id, stage.name);
  }

  const enrichedOpps: EnrichedOpportunity[] = [];

  for (const opp of opportunities) {
    const existing = stageMap.get(opp.pipelineStageId);
    if (existing) {
      existing.count++;
      existing.monetaryValue += opp.monetaryValue || 0;
    }

    enrichedOpps.push({
      id: opp.id,
      name: opp.name || "",
      contactId: opp.contactId || opp.contact?.id || "",
      contactName: opp.contact?.name || "",
      contactEmail: opp.contact?.email || "",
      contactPhone: opp.contact?.phone || "",
      stageName: stageNameMap.get(opp.pipelineStageId) || "Desconhecida",
      pipelineName: pipeline.name,
      monetaryValue: opp.monetaryValue || 0,
      status: opp.status || "open",
    });
  }

  const stageMetrics = sortedStages.map((stage) => {
    const metrics = stageMap.get(stage.id)!;
    return {
      pipelineId: pipeline.id,
      stageId: stage.id,
      stageName: stage.name,
      count: metrics.count,
      monetaryValue: metrics.monetaryValue,
    };
  });

  return { pipelineData, stageMetrics, enrichedOpps };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GHL_API_KEY");
    const locationId = Deno.env.get("GHL_LOCATION_ID");

    if (!apiKey || !locationId) {
      console.error("[GHL] Missing GHL_API_KEY or GHL_LOCATION_ID secrets");
      return new Response(
        JSON.stringify({ error: "Configuração GHL em falta. Verifica os secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawPipelines = await fetchPipelines(apiKey, locationId);

    // Fetch opportunities for pipelines sequentially to respect rate limits
    const results = [];
    for (const pipeline of rawPipelines) {
      const opportunities = await fetchAllOpportunities(apiKey, locationId, pipeline.id);
      results.push(processPipelineData(pipeline, opportunities));
    }

    const pipelines = results.map((r) => r.pipelineData);
    const allStageMetrics = results.flatMap((r) => r.stageMetrics);
    const allOpportunities = results.flatMap((r) => r.enrichedOpps);

    const responseBody = { pipelines, stageMetrics: allStageMetrics, opportunities: allOpportunities };
    console.log("[GHL] Response ready:", JSON.stringify({
      pipelineCount: pipelines.length,
      stageMetricCount: allStageMetrics.length,
      totalOpportunities: allOpportunities.length,
    }));

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[GHL] Error:", message);

    const status = message.includes("GHL_AUTH_ERROR")
      ? 401
      : message.includes("GHL_RATE_LIMIT")
        ? 429
        : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
