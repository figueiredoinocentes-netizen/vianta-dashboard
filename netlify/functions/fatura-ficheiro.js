// Ficheiro original das faturas — Supabase Storage, bucket privado `faturas` (ESM).
//   POST { filename, contentType, dataBase64, data? }  → guarda o ficheiro e devolve { path }
//        (pasta AAAA/MM pela data da fatura, se vier; senão pela data de hoje)
//   GET  ?path=<caminho>                        → redireciona para um URL assinado temporário (10 min)

const BUCKET = 'faturas';
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const PATH_RE = /^\d{4}\/\d{2}\/[A-Za-z0-9._-]+$/;

const PROD_ORIGIN = 'https://vianta-dashboard.netlify.app';
const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--vianta-dashboard\.netlify\.app$/;

function cors(event) {
  const h = event.headers || {};
  const origin = h.origin || h.Origin;
  const allow = origin && (origin === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(origin)) ? origin : PROD_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

const json = (statusCode, headers, body) => ({
  statusCode,
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** "Fatura Nº 12/2026 (EDP).pdf" → "Fatura-N-12-2026-EDP.pdf" */
function nomeSeguro(filename) {
  const base = String(filename || 'fatura')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (base || 'fatura').slice(-80);
}

export const handler = async (event) => {
  const headers = cors(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return json(500, headers, { error: 'Configuração do Supabase em falta' });
  const auth = { Authorization: `Bearer ${key}`, apikey: key };

  try {
    if (event.httpMethod === 'POST') {
      const { filename, contentType, dataBase64, data } = JSON.parse(event.body || '{}');
      if (!dataBase64) return json(400, headers, { error: 'Ficheiro em falta' });
      const tipo = TIPOS.includes(contentType) ? contentType : null;
      if (!tipo) return json(400, headers, { error: 'Tipo de ficheiro não suportado (PDF ou imagem)' });

      const agora = new Date();
      const m = /^(\d{4})-(\d{2})/.exec(String(data || ''));
      const pasta = m ? `${m[1]}/${m[2]}` : `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, '0')}`;
      const path = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nomeSeguro(filename)}`;

      const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': tipo, 'x-upsert': 'false' },
        body: Buffer.from(dataBase64, 'base64'),
      });
      if (!res.ok) {
        console.error('Storage upload error:', await res.text());
        return json(500, headers, { error: 'Erro ao guardar o ficheiro' });
      }
      return json(200, headers, { path });
    }

    if (event.httpMethod === 'GET') {
      const path = (event.queryStringParameters || {}).path || '';
      if (!PATH_RE.test(path)) return json(400, headers, { error: 'Caminho inválido' });
      const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 600 }),
      });
      if (!res.ok) {
        console.error('Storage sign error:', await res.text());
        return json(404, headers, { error: 'Ficheiro não encontrado' });
      }
      const { signedURL } = await res.json();
      return { statusCode: 302, headers: { ...headers, Location: `${url}/storage/v1${signedURL}` }, body: '' };
    }

    return json(405, headers, { error: 'Method not allowed' });
  } catch (e) {
    console.error('fatura-ficheiro error:', e);
    return json(500, headers, { error: 'Erro interno' });
  }
};
