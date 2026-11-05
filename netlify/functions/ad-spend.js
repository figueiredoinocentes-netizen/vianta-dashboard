// Netlify Function — Ad spend from meta_spend_daily (Central Vianta Supabase)
// Returns investment entries aggregated by month + campaign
// Used by the dashboard when fetch-sheets-data edge function is unavailable

const SUPABASE_CENTRAL_URL = 'https://tuwcllpwvxzmrgrqviqu.supabase.co';
// Fallback: if env var not set, this function won't work
const SUPABASE_CENTRAL_SERVICE_KEY = process.env.SUPABASE_CENTRAL_SERVICE_KEY || '';

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (!SUPABASE_CENTRAL_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SUPABASE_CENTRAL_SERVICE_KEY not configured' }),
    };
  }

  try {
    // Fetch all meta_spend_daily records from Central Vianta
    const response = await fetch(
      `${SUPABASE_CENTRAL_URL}/rest/v1/meta_spend_daily?select=data,campaign_name,campaign_id,spend&order=data.asc`,
      {
        headers: {
          apikey: SUPABASE_CENTRAL_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_CENTRAL_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Supabase fetch error:', response.status, errText);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: `Supabase error [${response.status}]: ${errText}` }),
      };
    }

    const rows = await response.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ investmentEntries: [] }),
      };
    }

    // Aggregate by month + campaign
    const aggregated = new Map();

    for (const row of rows) {
      if (!row.data || !row.campaign_name) continue;
      const month = row.data.substring(0, 7); // "YYYY-MM"
      const campaign = row.campaign_name;
      const key = `${month}||${campaign}`;
      const spend = parseFloat(row.spend) || 0;

      if (aggregated.has(key)) {
        aggregated.get(key).valor += spend;
      } else {
        aggregated.set(key, { mes: month, campanha: campaign, valor: spend });
      }
    }

    const investmentEntries = Array.from(aggregated.values());

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ investmentEntries }),
    };
  } catch (err) {
    console.error('ad-spend function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};