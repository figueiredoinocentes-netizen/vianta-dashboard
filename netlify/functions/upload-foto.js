// Uploads a vehicle photo to Supabase Storage and returns its public URL.
const BUCKET = 'carros-fotos';

const PROD_ORIGIN = 'https://vianta-dashboard.netlify.app';
const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--vianta-dashboard\.netlify\.app$/;

function resolveOrigin(event) {
  const origin = (event.headers || {}).origin || (event.headers || {}).Origin;
  if (origin && (origin === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(origin))) return origin;
  return PROD_ORIGIN;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || PROD_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

export const handler = async (event) => {
  const origin = resolveOrigin(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(origin), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: 'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set' }) };
  }

  try {
    const { filename, contentType, dataBase64 } = JSON.parse(event.body || '{}');
    if (!filename || !dataBase64) {
      return { statusCode: 400, headers: cors(origin), body: JSON.stringify({ error: 'filename and dataBase64 required' }) };
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}-${safeName}`;
    const bytes = Buffer.from(dataBase64, 'base64');

    const res = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': contentType || 'application/octet-stream',
      },
      body: bytes,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Storage upload error:', text);
      return { statusCode: 502, headers: cors(origin), body: JSON.stringify({ error: 'Erro ao enviar imagem' }) };
    }

    const url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
    return { statusCode: 200, headers: cors(origin), body: JSON.stringify({ url }) };
  } catch (e) {
    console.error('upload-foto internal error:', e);
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
