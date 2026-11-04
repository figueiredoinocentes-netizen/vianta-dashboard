// vendas-data — dados comerciais de verdade (Dashboard Marketing & Comercial)
// lê vendas + meta_spend_daily + campanha_oferta do Supabase Central Vianta (tuwcll)
// e resolve o "oferta" de cada linha de spend via campanha_oferta (por ID primeiro).
// Substitui a Google Sheet "Base de Dados Drivers Fechados" como fonte do dashboard.
// Usa as mesmas env vars que central.js: SUPABASE_URL + SUPABASE_SERVICE_KEY.
export const handler = async (event) => {
  const PROD_ORIGIN = 'https://vianta-dashboard.netlify.app';
  const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--vianta-dashboard\.netlify\.app$/;

  const origin = (event.headers || {}).origin || (event.headers || {}).Origin;
  const allowOrigin = origin && (origin === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(origin)) ? origin : PROD_ORIGIN;
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, apikey',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE env missing' }) };

  const auth = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    async function rest(table, select) {
      const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`, { headers: auth });
      if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
      return res.json();
    }

    const [vendas, spend, campanhas] = await Promise.all([
      rest('vendas', 'id,tipo,carro_id,motorista_id,ghl_contact_id,cliente_nome,data_lead,data_entrada,data_saida,valor_total,valor_semanal,fonte,ghl_opportunity_id'),
      rest('meta_spend_daily', 'data,campaign_id,campaign_name,spend,impressions,clicks'),
      rest('campanha_oferta', 'campanha,campaign_id,oferta'),
    ]);

    // resolve oferta por campaign_id primeiro, depois por nome
    const byId = new Map(campanhas.filter(c => c.campaign_id).map(c => [c.campaign_id, c.oferta]));
    const byName = new Map(campanhas.filter(c => c.campanha).map(c => [c.campanha, c.oferta]));

    const spendRows = spend.map(s => ({
      data: s.data,
      campaign_id: s.campaign_id,
      campaign_name: s.campaign_name,
      spend: Number(s.spend) || 0,
      impressions: s.impressions,
      clicks: s.clicks,
      oferta: (s.campaign_id && byId.get(s.campaign_id)) || byName.get(s.campaign_name) || null,
    }));

    const fontes = [...new Set(vendas.map(v => v.fonte).filter(Boolean))].sort();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ vendas, spend: spendRows, fontes, _source: 'supabase-vendas' }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};