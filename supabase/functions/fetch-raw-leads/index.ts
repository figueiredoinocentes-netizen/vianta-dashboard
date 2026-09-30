const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseDate(dateStr: string): string | null {
  if (!dateStr?.trim()) return null;
  const cleaned = dateStr.trim();

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);

  // Try MM/DD/YYYY or DD/MM/YYYY
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 100) {
      // a/b/c where c is year
      if (a > 12) return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`; // DD/MM/YYYY
      if (b > 12) return `${c}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`; // MM/DD/YYYY
      // Ambiguous — assume DD/MM/YYYY (European/PT format)
      return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    const SHEET_ID = '1s9ByVhHXQppWAQsZrgudw4d4GMdzR-qaK0ObPLdRejg';
    const RANGE = 'RAW_LEADS!A:M';

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Sheets API error [${res.status}]: ${errText}`);
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    if (rows.length < 2) {
      return new Response(JSON.stringify({ leads: [], headers: rows[0] || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detect column indices from header row
    const headerRow = rows[0].map((h: string) => h.trim().toLowerCase());
    const colMap: Record<string, number> = {};
    headerRow.forEach((h: string, i: number) => { colMap[h] = i; });

    // Map known column names (case-insensitive)
    const iId = colMap['id'] ?? 0;
    const iNome = colMap['nome'] ?? 1;
    const iOferta = headerRow.findIndex((h: string) => h.includes('oferta') && h.includes('pipeline')) ?? headerRow.findIndex((h: string) => h === 'oferta') ?? 4;
    const iSubcat = headerRow.findIndex((h: string) => h.includes('subcategoria')) ?? 5;
    const iData = headerRow.findIndex((h: string) => h.includes('data') && h.includes('registo')) ?? 6;
    const iFonte = colMap['fonte'] ?? 7;
    const iLandingPage = headerRow.findIndex((h: string) => h.includes('landing')) !== -1 ? headerRow.findIndex((h: string) => h.includes('landing')) : 9;
    const iCampanha = colMap['campanha'] ?? 10;
    const iAdSet = headerRow.findIndex((h: string) => h.includes('ad set') || h === 'adset') !== -1 ? headerRow.findIndex((h: string) => h.includes('ad set') || h === 'adset') : 11;
    const iCriativo = colMap['criativo'] ?? 12;

    // Skip header row
    const leads = rows.slice(1).map((row) => ({
      id: (row[iId] || '').trim(),
      nome: (row[iNome] || '').trim(),
      oferta: (row[iOferta] || '').trim(),
      subcategoria: (row[iSubcat] || '').trim(),
      dataRegisto: parseDate(row[iData] || ''),
      fonte: (row[iFonte] || '').trim(),
      landingPage: (row[iLandingPage] || '').trim(),
      campanha: (row[iCampanha] || '').trim(),
      adSet: (row[iAdSet] || '').trim(),
      criativo: (row[iCriativo] || '').trim(),
    })).filter((l) => l.id);

    return new Response(JSON.stringify({ leads }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
