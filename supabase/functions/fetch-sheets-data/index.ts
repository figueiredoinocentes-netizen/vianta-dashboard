import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// --- Portuguese month name mapping ---
const PT_MONTH_MAP: Record<string, string> = {
  'janeiro': '01', 'jan': '01',
  'fevereiro': '02', 'fev': '02',
  'março': '03', 'mar': '03', 'marco': '03',
  'abril': '04', 'abr': '04',
  'maio': '05', 'mai': '05',
  'junho': '06', 'jun': '06',
  'julho': '07', 'jul': '07',
  'agosto': '08', 'ago': '08',
  'setembro': '09', 'set': '09',
  'outubro': '10', 'out': '10',
  'novembro': '11', 'nov': '11',
  'dezembro': '12', 'dez': '12',
};

// English month fallback
const EN_MONTH_MAP: Record<string, string> = {
  'january': '01', 'jan': '01',
  'february': '02', 'feb': '02',
  'march': '03', 'mar': '03',
  'april': '04', 'apr': '04',
  'may': '05',
  'june': '06', 'jun': '06',
  'july': '07', 'jul': '07',
  'august': '08', 'aug': '08',
  'september': '09', 'sep': '09',
  'october': '10', 'oct': '10',
  'november': '11', 'nov': '11',
  'december': '12', 'dec': '12',
};

function parseMonthHeader(header: string, fallbackYear: string): string | null {
  const cleaned = header.trim().toLowerCase();
  if (!cleaned) return null;

  // Try "Jan 25", "Fev 2025", "Janeiro 2025", etc.
  const parts = cleaned.split(/[\s\/\-]+/);
  const monthPart = parts[0];
  const yearPart = parts.length > 1 ? parts[parts.length - 1] : null;

  const monthNum = PT_MONTH_MAP[monthPart] || EN_MONTH_MAP[monthPart];
  if (!monthNum) return null;

  let year = fallbackYear;
  if (yearPart) {
    if (yearPart.length === 4) {
      year = yearPart;
    } else if (yearPart.length === 2) {
      year = `20${yearPart}`;
    }
  }

  return `${year}-${monthNum}`;
}

function parseNum(val: string | null | undefined): number {
  if (!val) return 0;
  const cleaned = val.toString().replace(/[€\s%]/g, '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function fetchSheetTab(apiKey: string, sheetId: string, tabName: string): Promise<string[][] | null> {
  // Wrap tab name in single quotes to handle special characters like "+"
  const quotedTab = `'${tabName}'`;
  const encodedTab = encodeURIComponent(quotedTab);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedTab}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Tab "${tabName}" fetch failed [${res.status}]: ${errText}`);
      return null;
    }
    const json = await res.json();
    const rows = json.values || null;
    console.log(`Tab "${tabName}" fetched: ${rows ? rows.length : 0} rows`);
    return rows;
  } catch (err) {
    console.warn(`Error fetching tab "${tabName}":`, err);
    return null;
  }
}

// --- Generic row parser ---
// Finds a row whose first cell contains `rowLabel` (case-insensitive) and
// returns monthly investment entries tagged with `campanha`.
function parseNamedRow(
  rows: string[][],
  rowLabel: string,
  campanha: string,
  fallbackYear: string
): Array<{ mes: string; campanha: string; valor: number }> {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0];
  const labelLower = rowLabel.toLowerCase();

  const matchedRow = rows.find(row =>
    row[0] && row[0].toLowerCase().includes(labelLower)
  );

  if (!matchedRow) {
    console.warn(`${fallbackYear}: Row "${rowLabel}" not found`);
    return [];
  }

  console.log(`${fallbackYear}: Found "${rowLabel}" row with ${matchedRow.length} columns`);

  const entries: Array<{ mes: string; campanha: string; valor: number }> = [];
  for (let i = 1; i < headers.length; i++) {
    const monthKey = parseMonthHeader(headers[i], fallbackYear);
    if (!monthKey) continue;

    const rawVal = matchedRow[i] ?? '';
    const valor = parseNum(matchedRow[i]);
    console.log(`${fallbackYear} [${campanha}]: Col ${i} (${monthKey}): raw="${rawVal}" → ${valor}${valor <= 0 ? ' (skipped)' : ''}`);
    if (valor > 0) {
      entries.push({ mes: monthKey, campanha, valor });
    }
  }

  console.log(`${fallbackYear}: Parsed ${entries.length} entries for "${campanha}"`);
  return entries;
}

// Determine last day of a month given year and month number
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Parse investment row with 2-line headers (month + weekly period)
function parseInvestmentRowWithWeeks(
  rows: string[][],
  campanha: string,
  fallbackYear: string
): Array<{ mes: string; campanha: string; valor: number; dataInicio?: string; dataFim?: string }> {
  if (!rows || rows.length < 3) return [];

  const headerRow1 = rows[0]; // Month names (may have merged/empty cells)
  const headerRow2 = rows[1]; // Period ranges like "1-7", "8-14" or empty

  console.log(`${fallbackYear} [${campanha}]: Header row 1 (months): ${JSON.stringify(headerRow1)}`);
  console.log(`${fallbackYear} [${campanha}]: Header row 2 (periods): ${JSON.stringify(headerRow2)}`);

  // Find the "investimento" row first (from row index 2 onwards) so we know max column count
  const investRow = rows.slice(2).find(row =>
    row[0] && row[0].toLowerCase().includes('investimento')
  );

  if (!investRow) {
    console.warn(`${fallbackYear}: Row "investimento" not found for "${campanha}"`);
    return [];
  }

  // Carry-forward month headers for merged cells — use max length across all rows
  const maxLen = Math.max(headerRow1.length, headerRow2.length, investRow.length);
  const monthHeaders: (string | null)[] = [];
  let lastMonth: string | null = null;
  for (let i = 0; i < maxLen; i++) {
    const cell = (headerRow1[i] ?? '').trim();
    if (cell) {
      const parsed = parseMonthHeader(cell, fallbackYear);
      if (parsed) {
        lastMonth = parsed;
        monthHeaders.push(parsed);
      } else {
        monthHeaders.push(lastMonth);
      }
    } else {
      monthHeaders.push(lastMonth); // carry forward from merged cell
    }
  }

  console.log(`${fallbackYear} [${campanha}]: Found investimento row with ${investRow.length} columns`);

  const entries: Array<{ mes: string; campanha: string; valor: number; dataInicio?: string; dataFim?: string }> = [];
  const year = parseInt(fallbackYear);

  for (let i = 1; i < investRow.length; i++) {
    const monthKey = monthHeaders[i];
    if (!monthKey) continue;

    const rawVal = investRow[i] ?? '';
    const valor = parseNum(investRow[i]);
    const periodCell = (headerRow2[i] || '').trim();
    console.log(`${fallbackYear} [${campanha}]: Col ${i} (${monthKey}, period "${periodCell}"): raw="${rawVal}" → ${valor}${valor <= 0 ? ' (skipped)' : ''}`);
    if (valor <= 0) continue;

    const monthNum = parseInt(monthKey.split('-')[1]);

    // Parse period range like "1-7"
    const periodMatch = periodCell.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);

    let dataInicio: string | undefined;
    let dataFim: string | undefined;

    if (periodMatch) {
      const startDay = parseInt(periodMatch[1]);
      const endDay = parseInt(periodMatch[2]);
      dataInicio = `${fallbackYear}-${String(monthNum).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      dataFim = `${fallbackYear}-${String(monthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    } else {
      // No weekly period — use full month range
      const lastDay = lastDayOfMonth(year, monthNum);
      dataInicio = `${fallbackYear}-${String(monthNum).padStart(2, '0')}-01`;
      dataFim = `${fallbackYear}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    entries.push({ mes: monthKey, campanha, valor, dataInicio, dataFim });
  }

  console.log(`${fallbackYear}: Parsed ${entries.length} weekly entries for "${campanha}"`);
  return entries;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    const GOOGLE_SHEET_ID = Deno.env.get('GOOGLE_SHEET_ID');
    const GOOGLE_SHEET_ID_2025 = Deno.env.get('GOOGLE_SHEET_ID_2025');
    const GOOGLE_SHEET_ID_2026 = Deno.env.get('GOOGLE_SHEET_ID_2026');

    if (!GOOGLE_SHEETS_API_KEY) {
      throw new Error('GOOGLE_SHEETS_API_KEY is not configured');
    }
    if (!GOOGLE_SHEET_ID) {
      throw new Error('GOOGLE_SHEET_ID is not configured');
    }

    // --- Fetch drivers from main sheet ---
    const driversRange = encodeURIComponent('Base de Dados Drivers Fechados');
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values`;

    console.log('Fetching Google Sheets data...');

    // Start all fetches in parallel
    const driversPromise = fetch(`${baseUrl}/${driversRange}?key=${GOOGLE_SHEETS_API_KEY}&valueRenderOption=FORMATTED_VALUE`);

    // Investment 2025
    const invest2025Promise = GOOGLE_SHEET_ID_2025
      ? fetchSheetTab(GOOGLE_SHEETS_API_KEY, GOOGLE_SHEET_ID_2025, 'Dashboard Aquisição Drivers')
      : Promise.resolve(null);

    // First, get 2026 sheet metadata to discover actual tab names
    let tabs2026: string[] = [];
    const targetTabs2026 = ['Slot', 'Aluguer TVDE', 'Aluguer TVDE + Tours', 'Aluguer Prestige', 'Venda'];
    // Also fetch Dashboard tab from 2026 for Comercial costs
    let dashboardTab2026Name: string | null = null;
    
    if (GOOGLE_SHEET_ID_2026) {
      try {
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID_2026}?key=${GOOGLE_SHEETS_API_KEY}&fields=sheets.properties.title`;
        const metaRes = await fetch(metaUrl);
        if (metaRes.ok) {
          const metaJson = await metaRes.json();
          const allTabs = metaJson.sheets?.map((s: any) => s.properties?.title).filter(Boolean) || [];
          console.log('2026 sheet available tabs:', JSON.stringify(allTabs));
          
          // Match target tabs case-insensitively
          tabs2026 = targetTabs2026.map(target => {
            const match = allTabs.find((t: string) => t.toLowerCase() === target.toLowerCase());
            if (match) return match;
            // Try partial match
            const partial = allTabs.find((t: string) => t.toLowerCase().includes(target.toLowerCase()));
            if (partial) {
              console.log(`2026: Matched "${target}" -> "${partial}" (partial)`);
              return partial;
            }
            console.warn(`2026: Tab "${target}" not found in sheet`);
            return null;
          }).filter(Boolean) as string[];
          
          console.log('2026 tabs to fetch:', JSON.stringify(tabs2026));

          // Find Dashboard tab for Comercial costs
          const dashMatch = allTabs.find((t: string) => t.toLowerCase().includes('dashboard'));
          if (dashMatch) {
            dashboardTab2026Name = dashMatch;
            console.log(`2026: Found Dashboard tab -> "${dashMatch}"`);
          } else {
            console.warn('2026: Dashboard tab not found');
          }
        } else {
          const errText = await metaRes.text();
          console.warn(`2026 sheet metadata fetch failed [${metaRes.status}]: ${errText}`);
        }
      } catch (err) {
        console.warn('Error fetching 2026 sheet metadata:', err);
      }
    }

    const invest2026Promises = GOOGLE_SHEET_ID_2026 && tabs2026.length > 0
      ? tabs2026.map(tab => fetchSheetTab(GOOGLE_SHEETS_API_KEY, GOOGLE_SHEET_ID_2026!, tab))
      : [];

    // Fetch 2026 Dashboard tab for Comercial
    const dashboard2026Promise = GOOGLE_SHEET_ID_2026 && dashboardTab2026Name
      ? fetchSheetTab(GOOGLE_SHEETS_API_KEY, GOOGLE_SHEET_ID_2026!, dashboardTab2026Name)
      : Promise.resolve(null);

    const [driversRes, invest2025Rows, dashboard2026Rows, ...invest2026Results] = await Promise.all([
      driversPromise,
      invest2025Promise,
      dashboard2026Promise,
      ...invest2026Promises,
    ]);

    // Parse drivers
    if (!driversRes.ok) {
      const errText = await driversRes.text();
      console.error('Drivers fetch error:', driversRes.status, errText);
      throw new Error(`Failed to fetch drivers sheet [${driversRes.status}]: ${errText}`);
    }

    const driversJson = await driversRes.json();
    const driversRows: string[][] = driversJson.values || [];

    if (driversRows.length === 0) {
      console.log('No driver data found');
      return new Response(JSON.stringify({ drivers: [], investmentEntries: [], fontes: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = driversRows[0].map((h: string) => h.trim());
    console.log('Driver sheet headers:', headers);

    // Flexible column matching
    const findCol = (names: string[]): number => {
      for (const name of names) {
        const idx = headers.findIndex((h: string) => h.toLowerCase() === name.toLowerCase());
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const col = {
      id: findCol(['ID', 'Id', 'id']),
      nome: findCol(['Nome', 'nome']),
      fonte: findCol(['Fonte', 'fonte', 'Campanha']),
      oferta: findCol(['Oferta', 'oferta', 'Tipo Oferta', 'Tipo de Oferta']),
      ticket: findCol(['Ticket', 'ticket']),
      dataFecho: findCol(['Data de Fecho', 'Data Fecho', 'dataFecho']),
      dataLead: findCol(['Data Ang. Lead', 'Data Lead', 'dataLead', 'Data Angariação Lead', 'Data Ang Lead']),
      dataSaida: findCol(['Data de Saida', 'Data de Saída', 'Data Saida', 'dataSaida']),
      motivoPerda: findCol(['Motivo de Perda', 'Motivo Perda', 'motivoPerda']),
      observacoes: findCol(['Observacoes', 'Observações', 'observacoes', 'Obs']),
    };

    console.log('Column indices:', JSON.stringify(col));

    const getVal = (row: string[], idx: number): string | null => {
      if (idx < 0 || idx >= row.length) return null;
      const v = row[idx]?.trim();
      return v || null;
    };

    const parseNumDriver = (val: string | null): number | null => {
      if (!val) return null;
      const cleaned = val.replace(/[€\s]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    };

    const drivers = driversRows.slice(1)
      .filter((row: string[]) => row.some((cell: string) => cell?.trim()))
      .map((row: string[], i: number) => ({
        id: getVal(row, col.id) || String(i + 1),
        nome: getVal(row, col.nome) || '',
        fonte: getVal(row, col.fonte) || '',
        tipoOferta: (getVal(row, col.oferta) || '').toLowerCase(),
        ticket: parseNumDriver(getVal(row, col.ticket)),
        dataFecho: getVal(row, col.dataFecho),
        dataLead: getVal(row, col.dataLead),
        dataSaida: getVal(row, col.dataSaida),
        motivoPerda: getVal(row, col.motivoPerda),
        observacoes: getVal(row, col.observacoes),
      }));

    console.log(`Parsed ${drivers.length} drivers`);

    // --- Parse investment data from control sheets ---
    let investmentEntries: Array<{ mes: string; campanha: string; valor: number }> = [];

    // 2025 investment: Ads + Comercial
    if (invest2025Rows) {
      investmentEntries.push(...parseNamedRow(invest2025Rows, 'investimento ads', 'Slot', '2025'));
      investmentEntries.push(...parseNamedRow(invest2025Rows, 'comercial', 'Comercial', '2025'));
    } else {
      console.warn('No 2025 investment data available (sheet ID not configured or tab not found)');
    }

    // 2026 investment: per-campaign tabs (with weekly support)
    // Rule: if a month has weekly entries, ignore any monthly aggregate for the same month/campaign.
    for (let i = 0; i < tabs2026.length; i++) {
      const rows = invest2026Results[i];
      if (!rows) continue;
      const entries = parseInvestmentRowWithWeeks(rows, tabs2026[i], '2026');

      // Identify months that have at least one true weekly entry (span < 28 days)
      const dayMs = 86400000;
      const monthsWithWeekly = new Set<string>();
      for (const e of entries) {
        if (!e.dataInicio || !e.dataFim) continue;
        const start = new Date(e.dataInicio).getTime();
        const end = new Date(e.dataFim).getTime();
        const span = Math.floor((end - start) / dayMs) + 1;
        if (span > 0 && span < 28) {
          monthsWithWeekly.add(e.mes);
        }
      }

      // Keep weekly entries; drop monthly aggregates for months that already have weekly data
      const deduped = entries.filter((e) => {
        if (!e.dataInicio || !e.dataFim) return true;
        const start = new Date(e.dataInicio).getTime();
        const end = new Date(e.dataFim).getTime();
        const span = Math.floor((end - start) / dayMs) + 1;
        const isMonthlyAggregate = span >= 28;
        if (isMonthlyAggregate && monthsWithWeekly.has(e.mes)) {
          console.log(`${tabs2026[i]} ${e.mes}: dropping monthly aggregate €${e.valor} (weekly entries present)`);
          return false;
        }
        return true;
      });

      investmentEntries.push(...deduped);
    }

    // 2026 Comercial from Dashboard tab
    if (dashboard2026Rows) {
      investmentEntries.push(...parseNamedRow(dashboard2026Rows, 'comercial', 'Comercial', '2026'));
    }

    console.log(`Total investment entries: ${investmentEntries.length}`);

    // Get unique fontes for dynamic filters
    const fontes = [...new Set(drivers.map((d) => d.fonte).filter(Boolean))].sort();
    console.log('Unique sources:', fontes);

    // Debug: aggregate investment by month
    const debugByMonth: Record<string, number> = {};
    for (const e of investmentEntries) {
      debugByMonth[e.mes] = (debugByMonth[e.mes] || 0) + e.valor;
    }
    console.log('Investment totals by month:', JSON.stringify(debugByMonth));

    return new Response(JSON.stringify({ drivers, investmentEntries, fontes, _debug: { investmentByMonth: debugByMonth } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
