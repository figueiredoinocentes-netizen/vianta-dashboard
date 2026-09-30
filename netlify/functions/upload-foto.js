// Upload foto — Supabase Storage
// Recebe base64 de uma imagem comprimida, faz upload ao bucket carros-fotos,
// devolve a URL pública.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tuwcllpwvxzmrgrqviqu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { filename, contentType = 'image/jpeg', dataBase64 } = JSON.parse(event.body);

    if (!dataBase64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'dataBase64 é obrigatório' }) };
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    const ext = filename?.split('.').pop() || 'jpg';
    const objectName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bucket = 'carros-fotos';

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Supabase storage error: ${text}` }) };
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectName}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: publicUrl }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};