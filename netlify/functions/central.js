// Central Vianta API — Netlify Function (CommonJS)
// Wraps Supabase REST API for motoristas, pagamentos, carros, armazem

const TABLE_MAP = {
  motoristas: 'motoristas',
  pagamentos: 'pagamentos',
  carros: 'carros',
  armazem: 'armazem',
  investidores: 'investidores',
  clientes: 'clientes',
};

const PROD_ORIGIN = 'https://vianta-dashboard.netlify.app';
// Matches Netlify branch/deploy-preview subdomains for this same site, e.g.
// dev--vianta-dashboard.netlify.app, deploy-preview-3--vianta-dashboard.netlify.app
const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--vianta-dashboard\.netlify\.app$/;

function resolveOrigin(event) {
  const origin = (event.headers || {}).origin || (event.headers || {}).Origin;
  if (origin && (origin === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(origin))) return origin;
  return PROD_ORIGIN;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || PROD_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, apikey',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function ok(data, origin) {
  return { statusCode: 200, headers: cors(origin), body: JSON.stringify(data) };
}

function err(msg, code = 500, origin) {
  return { statusCode: code, headers: cors(origin), body: JSON.stringify({ error: msg }) };
}

// Logs the real Supabase/internal error server-side (Netlify function logs)
// and returns a generic message to the client, so internal details never leak.
async function supaErr(res, context, origin) {
  const text = await res.text();
  console.error(`Supabase error [${context}]:`, text);
  return err('Erro ao aceder à base de dados', res.status, origin);
}

function internalErr(e, context, origin) {
  console.error(`Internal error [${context}]:`, e);
  return err('Erro interno', 500, origin);
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

export const handler = async (event) => {
  const origin = resolveOrigin(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(origin), body: '' };
  }

  const type = (event.queryStringParameters || {}).type;
  const table = TABLE_MAP[type];
  if (!table) {
    return err(`Invalid type. Must be: ${Object.keys(TABLE_MAP).join(', ')}`, 400, origin);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return err('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set', 500, origin);
  }

  const baseUrl = `${supabaseUrl}/rest/v1/${table}`;
  const headers = sbHeaders();

  try {
    if (event.httpMethod === 'GET') {
      const url = `${baseUrl}?select=*`;
      const res = await fetch(url, { headers });
      if (!res.ok) return await supaErr(res, `GET ${table}`, origin);
      const data = await res.json();
      return ok(data, origin);
    }

    if (event.httpMethod === 'POST') {
      if (!event.body) return err('Body required for POST', 400, origin);
      const record = JSON.parse(event.body);
      const res = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(record) });
      if (!res.ok) return await supaErr(res, `POST ${table}`, origin);
      const data = await res.json();
      return ok(data, origin);
    }

    if (event.httpMethod === 'PUT') {
      if (!event.body) return err('Body required for PUT', 400, origin);
      const { id, field, value } = JSON.parse(event.body);
      if (!id || !field) return err('PUT body must include id and field', 400, origin);
      const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ [field]: value }) });
      if (!res.ok) return await supaErr(res, `PUT ${table}`, origin);
      return ok({ updated: true }, origin);
    }

    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return err('DELETE requires ?id=', 400, origin);
      const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      if (!res.ok) return await supaErr(res, `DELETE ${table}`, origin);
      return ok({ deleted: true }, origin);
    }

    return err('Method not allowed', 405, origin);
  } catch (e) {
    return internalErr(e, `${event.httpMethod} ${table}`, origin);
  }
};