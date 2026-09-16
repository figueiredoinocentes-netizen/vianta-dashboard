// Central Vianta API — Netlify Function
// Wraps Supabase REST API for motoristas, pagamentos, carros, armazem

const TABLE_MAP = {
  motoristas: 'motoristas',
  pagamentos: 'pagamentos',
  carros: 'carros',
  armazem: 'armazem',
};

const ALLOWED_ORIGINS = [
  'https://vianta-dashboard.netlify.app',
  'http://localhost:5173',
  'http://localhost:8888',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://vianta-dashboard.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function errorResponse(status, message, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters, body, headers } = event;
  const origin = headers?.origin || '';
  const cors = corsHeaders(origin);

  // Handle preflight CORS
  if (httpMethod === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const type = queryStringParameters?.type;
  const table = TABLE_MAP[type];

  if (!table) {
    return errorResponse(400, `Invalid or missing type. Must be one of: ${Object.keys(TABLE_MAP).join(', ')}`, origin);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return errorResponse(500, 'SUPABASE_URL not configured', origin);
  }
  if (!process.env.SUPABASE_SERVICE_KEY) {
    return errorResponse(500, 'SUPABASE_SERVICE_KEY not configured', origin);
  }

  const baseUrl = `${supabaseUrl}/rest/v1/${table}`;
  const sbHeaders = supabaseHeaders();

  try {
    let response;

    switch (httpMethod) {
      case 'GET': {
        // List all records
        const url = `${baseUrl}?select=*`;
        response = await fetch(url, {
          method: 'GET',
          headers: sbHeaders,
        });
        break;
      }

      case 'POST': {
        // Create new record
        if (!body) {
          return errorResponse(400, 'Request body is required for POST', origin);
        }
        const record = JSON.parse(body);
        response = await fetch(baseUrl, {
          method: 'POST',
          headers: sbHeaders,
          body: JSON.stringify(record),
        });
        break;
      }

      case 'PUT': {
        // Update a record — body must have { id, field, value }
        if (!body) {
          return errorResponse(400, 'Request body is required for PUT', origin);
        }
        const { id, field, value } = JSON.parse(body);
        if (!id || !field || value === undefined) {
          return errorResponse(400, 'PUT body must include id, field, and value', origin);
        }
        const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
        response = await fetch(url, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ [field]: value }),
        });
        break;
      }

      case 'DELETE': {
        // Delete a record — query param ?id=
        const id = queryStringParameters?.id;
        if (!id) {
          return errorResponse(400, 'DELETE requires ?id= query parameter', origin);
        }
        const url = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
        response = await fetch(url, {
          method: 'DELETE',
          headers: sbHeaders,
        });
        break;
      }

      default:
        return errorResponse(405, `Method ${httpMethod} not allowed`, origin);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return errorResponse(response.status, `Supabase error: ${errorText}`, origin);
    }

    const data = httpMethod === 'DELETE' ? { deleted: true } : await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return errorResponse(500, `Internal error: ${err.message}`, origin);
  }
};