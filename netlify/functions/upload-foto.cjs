// Upload foto — Supabase Storage (CommonJS)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { filename, dataBase64 } = JSON.parse(event.body);
    if (!dataBase64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'dataBase64 required' }) };

    const ext = (filename || 'image').split('.').pop() || 'jpg';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const bucket = 'carros-fotos';

    const binary = Buffer.from(dataBase64, 'base64');
    const res = await fetch(SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + name, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY, 'Content-Type': 'image/jpeg' },
      body: binary,
    });

    if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: await res.text() }) };

    return { statusCode: 200, headers, body: JSON.stringify({ url: SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + name }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};