// Leads da sheet "DB Leads Log" (aba RAW_LEADS), alimentada pelo GHL. Serve para ligar uma
// venda à lead que a originou (campanha, ad set, criativo). Só leitura.
// Auth: a mesma service account do Drive (GOOGLE_DRIVE_SERVICE_ACCOUNT); a sheet tem de estar
// partilhada com o email dessa service account (leitor).
import crypto from 'node:crypto';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const SHEET_ID = '1s9ByVhHXQppWAQsZrgudw4d4GMdzR-qaK0ObPLdRejg';
const RANGE = 'RAW_LEADS!A1:M';

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: DRIVE_SCOPE,
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google auth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

export const handler = async (event) => {
  const origin = resolveOrigin(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(origin), body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors(origin), body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!raw) {
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: 'GOOGLE_DRIVE_SERVICE_ACCOUNT must be set' }) };
  }
  let sa;
  try {
    sa = JSON.parse(raw);
    const token = await getAccessToken(sa);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const semAcesso = res.status === 403 || res.status === 404;
      return {
        statusCode: semAcesso ? 403 : 502,
        headers: cors(origin),
        body: JSON.stringify({
          error: semAcesso
            ? `Sem acesso à sheet DB Leads Log: partilhar (leitor) com ${sa.client_email}`
            : `Sheets API ${res.status}`,
        }),
      };
    }
    const { values = [] } = await res.json();
    const [cab = [], ...linhas] = values;
    const col = (nome) => cab.indexOf(nome);
    const c = {
      id: col('ID'), nome: col('Nome'), email: col('Email'), tel: col('Telemóvel'), oferta: col('Oferta (Pipeline)'),
      data: col('Data Registo'), fonte: col('Fonte'), campanha: col('Campanha'), adset: col('Ad Set'), criativo: col('Criativo'),
    };
    const v = (l, i) => (i >= 0 ? (l[i] ?? '').toString().trim() : '');
    const leads = linhas
      .filter((l) => v(l, c.id))
      .map((l) => ({
        id: v(l, c.id), nome: v(l, c.nome), email: v(l, c.email), telemovel: v(l, c.tel), oferta: v(l, c.oferta),
        data: v(l, c.data), fonte: v(l, c.fonte), campanha: v(l, c.campanha), adset: v(l, c.adset), criativo: v(l, c.criativo),
      }));
    // Sem login no dashboard: nunca devolver a lista inteira (dados pessoais). Só pesquisa
    // (?q=, mínimo 3 caracteres, até 8 resultados) ou leads pedidas por ID (?ids=a,b,c).
    const qs = event.queryStringParameters || {};
    const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let out = [];
    if (qs.ids) {
      const ids = new Set(String(qs.ids).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 100));
      out = leads.filter((l) => ids.has(l.id));
    } else if (qs.q && String(qs.q).trim().length >= 3) {
      const t = norm(String(qs.q).trim());
      const dig = String(qs.q).replace(/\D/g, '');
      out = leads
        .filter((l) => norm(l.nome).includes(t) || norm(l.email).includes(t) || (dig.length >= 3 && l.telemovel.replace(/\D/g, '').includes(dig)))
        .reverse()
        .slice(0, 8);
    }
    return { statusCode: 200, headers: { ...cors(origin), 'Cache-Control': 'private, no-store' }, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
