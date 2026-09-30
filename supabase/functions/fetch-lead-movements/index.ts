import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SHEET_ID = '1s9ByVhHXQppWAQsZrgudw4d4GMdzR-qaK0ObPLdRejg';
const TAB_NAME = 'RAW_EVENTS';

function parseDate(raw: string): string | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  let a = parseInt(match[1]);
  let b = parseInt(match[2]);
  const year = parseInt(match[3]);
  const hour = parseInt(match[4]);
  const minute = parseInt(match[5]);

  // Auto-detect format: if first number > 12, it must be day (DD/MM/YYYY)
  let month: number, day: number;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    // Both <= 12: assume DD/MM/YYYY (European/PT format)
    day = a;
    month = b;
  }

  const d = new Date(year, month - 1, day, hour, minute);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_SHEETS_API_KEY not configured');

    const quotedTab = `'${TAB_NAME}'`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(quotedTab)}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const body = await resp.text();
      if (resp.status === 403) {
        throw new Error('Permission Denied. Ensure the sheet is shared as "Anyone with the link" (Viewer).');
      }
      throw new Error(`Google Sheets API error [${resp.status}]: ${body}`);
    }

    const json = await resp.json();
    const rows: string[][] = json.values || [];

    if (rows.length < 2) {
      return new Response(JSON.stringify({ movements: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataRows = rows.slice(1);
    const movements: { id: string; nome: string; pipeline: string; stage: string; date: string }[] = [];

    for (const row of dataRows) {
      const id = (row[0] || '').trim();
      const nome = (row[1] || '').trim();
      const pipeline = (row[2] || '').trim();
      const stage = (row[3] || '').trim();
      const dataRaw = (row[4] || '').trim();

      if (!id || !pipeline || !stage || !dataRaw) continue;

      const date = parseDate(dataRaw);
      if (!date) continue;

      movements.push({ id, nome, pipeline, stage, date });
    }

    console.log(`Parsed ${movements.length} raw movements from ${dataRows.length} rows`);

    return new Response(JSON.stringify({ movements }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-lead-movements:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
