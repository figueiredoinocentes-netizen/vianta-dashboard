import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_docs/v1";

function extractDocId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return trimmed;
}

function docToMarkdown(doc: any): { title: string; markdown: string } {
  const title: string = doc.title || "";
  const lines: string[] = [];
  for (const el of doc.body?.content || []) {
    const p = el.paragraph;
    if (!p) continue;
    const elements = p.elements || [];
    let text = "";
    for (const e of elements) {
      const tr = e.textRun;
      if (tr?.content) text += tr.content;
    }
    text = text.replace(/\n+$/g, "");
    if (!text.trim()) {
      lines.push("");
      continue;
    }
    const style: string = p.paragraphStyle?.namedStyleType || "";
    if (style.startsWith("HEADING_")) {
      const lvl = parseInt(style.split("_")[1] || "1", 10);
      lines.push(`${"#".repeat(Math.min(lvl, 6))} ${text.trim()}`);
    } else if (style === "TITLE") {
      lines.push(`# ${text.trim()}`);
    } else {
      const bullet = p.bullet ? "- " : "";
      lines.push(`${bullet}${text}`);
    }
  }
  // Collapse multiple blank lines
  const md = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title, markdown: md };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_DOCS_API_KEY = Deno.env.get("GOOGLE_DOCS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!GOOGLE_DOCS_API_KEY) throw new Error("GOOGLE_DOCS_API_KEY não configurada");

    const { docId: rawDocId, pipeline } = await req.json();
    if (!rawDocId || !pipeline) {
      return new Response(
        JSON.stringify({ error: "Parâmetros 'docId' e 'pipeline' são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const docId = extractDocId(String(rawDocId));
    const sourceUrl = `https://docs.google.com/document/d/${docId}/edit`;

    const res = await fetch(`${GATEWAY_URL}/documents/${docId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_DOCS_API_KEY,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Google Docs API falhou [${res.status}]: ${body.slice(0, 300)}`);
    }
    const doc = await res.json();
    const { title, markdown } = docToMarkdown(doc);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    const { error } = await sb
      .from("sales_playbooks")
      .upsert(
        {
          pipeline,
          title,
          content: markdown,
          source_url: sourceUrl,
          source_doc_id: docId,
          synced_at: now,
        },
        { onConflict: "pipeline" },
      );
    if (error) throw new Error(`Erro a guardar SOP: ${error.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        pipeline,
        title,
        charCount: markdown.length,
        syncedAt: now,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[sync-sales-playbook] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
