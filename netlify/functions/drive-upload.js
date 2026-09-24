// Uploads a document straight into a vehicle's Drive folder (multipart
// upload to the Drive API v3). Auth: service account JWT bearer flow,
// same as drive.js but with write scope.
import crypto from 'node:crypto';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

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
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(origin), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!raw) {
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: 'GOOGLE_DRIVE_SERVICE_ACCOUNT must be set' }) };
  }

  try {
    const { folderId, filename, contentType, dataBase64 } = JSON.parse(event.body || '{}');
    if (!folderId || !filename || !dataBase64) {
      return { statusCode: 400, headers: cors(origin), body: JSON.stringify({ error: 'folderId, filename and dataBase64 required' }) };
    }

    const sa = JSON.parse(raw);
    const token = await getAccessToken(sa);

    const metadata = { name: filename, parents: [folderId] };
    const bytes = Buffer.from(dataBase64, 'base64');
    const boundary = `vianta-${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${contentType || 'application/octet-stream'}\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Drive upload error:', text);
      return { statusCode: 502, headers: cors(origin), body: JSON.stringify({ error: 'Erro ao enviar para a Drive' }) };
    }

    const file = await res.json();
    return { statusCode: 200, headers: cors(origin), body: JSON.stringify({ file }) };
  } catch (e) {
    console.error('drive-upload error:', e);
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
