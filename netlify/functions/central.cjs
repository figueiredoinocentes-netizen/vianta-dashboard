// Central Vianta API — Netlify Function (CommonJS)
// Wraps Supabase REST API for motoristas, pagamentos, carros, armazem

const TABLE_MAP = {
  motoristas: 'motoristas',
  pagamentos: 'pagamentos',
  carros: 'carros',
  armazem: 'armazem',
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, apikey',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function ok(data) {
  return { statusCode: 200, headers: cors(), body: JSON.stringify(data) };
}

function err(msg, code = 500) {
  return { statusCode: code, headers: cors(), body: JSON.stringify({ error: msg }) };
}

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }

  const type = (event.queryStringParameters || {}).type;
  const table = TABLE_MAP[type];
  if (!table) {
    return err(`Invalid type. Must be: ${Object.keys(TABLE_MAP).join(', ')}`, 400);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return err('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set', 500);
  }

  const baseUrl = `${supabaseUrl}/rest/v1/${table}`;
  const headers = sbHeaders();

  try {
    if (event.httpMethod === 'GET') {
      const url = `${baseUrl}?select=*`;
      const res = await fetch(url, { headers });
      if (!res.ok) return err(`Supabase: ${await res.text()}`, res.status);
      const data = await res.json();
      return ok(data);
    }

    if (event.httpMethod === 'POST') {
      if (!event.body) return err('Body required for POST', 400);
      const record = JSON.parse(event.body);
      const res = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(record) });
      if (!res.ok) return err(`Supabase: ${await res.text()}`, res.status);
      const data = await res.json();
      return ok(data);
    }

    if (event.httpMethod === 'PUT') {
      if (!event.body) return err('Body required for PUT', 400);
      const { id, field, value } = JSON.parse(event.body);
      if (!id || !field) return err('PUT body must include id and field', 400);
      const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ [field]: value }) });
      if (!res.ok) return err(`Supabase: ${await res.text()}`, res.status);
      return ok({ updated: true });
    }

    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return err('DELETE requires ?id=', 400);
      const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      if (!res.ok) return err(`Supabase: ${await res.text()}`, res.status);
      return ok({ deleted: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(`Internal: ${e.message}`, 500);
  }
};