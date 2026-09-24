// Lists documents from a vehicle's Google Drive folder, inside the shared
// "CARROS" folder. Auth: service account JWT bearer flow (no npm deps).
import crypto from 'node:crypto';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

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

async function driveList(token, q, fields) {
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API failed: ${res.status} ${text}`);
  }
  return res.json();
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function findMatchingFolder(folders, matricula, modelo) {
  const normPlate = normalize(matricula);
  if (normPlate) {
    const byPlate = folders.find((f) => normalize(f.name).includes(normPlate));
    if (byPlate) return byPlate;
  }
  // Score every folder by how many model words it contains (NOT filtered by
  // length — dropping short words like "Y" or "3" is what previously made
  // "Tesla Model Y" match the "Tesla Model 3" folder, since both share the
  // generic words "tesla"/"model"). Pick the best match, and require at
  // least half the words to agree so a single generic word can't win alone.
  const modelWords = (modelo || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (modelWords.length) {
    let best = null;
    let bestScore = 0;
    for (const f of folders) {
      const fn = f.name.toLowerCase();
      const score = modelWords.filter((w) => fn.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = f; }
    }
    if (best && bestScore >= Math.ceil(modelWords.length / 2)) return best;
  }
  return null;
}

export const handler = async (event) => {
  const origin = resolveOrigin(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(origin), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors(origin), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!raw) {
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: 'GOOGLE_DRIVE_SERVICE_ACCOUNT must be set' }) };
  }

  const { matricula, modelo } = event.queryStringParameters || {};
  if (!matricula && !modelo) {
    return { statusCode: 400, headers: cors(origin), body: JSON.stringify({ error: 'matricula or modelo required' }) };
  }

  try {
    const sa = JSON.parse(raw);
    const token = await getAccessToken(sa);

    const rootRes = await driveList(
      token,
      "name='CARROS' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      'files(id,name)',
    );
    const root = rootRes.files && rootRes.files[0];
    if (!root) {
      return { statusCode: 404, headers: cors(origin), body: JSON.stringify({ error: 'Pasta CARROS não encontrada (verificar partilha com a service account)' }) };
    }

    const subRes = await driveList(
      token,
      `'${root.id}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
      'files(id,name,webViewLink)',
    );
    const folder = findMatchingFolder(subRes.files || [], matricula, modelo);
    if (!folder) {
      return { statusCode: 200, headers: cors(origin), body: JSON.stringify({ folder: null, files: [] }) };
    }

    const filesRes = await driveList(
      token,
      `'${folder.id}' in parents and trashed=false`,
      'files(id,name,mimeType,webViewLink,thumbnailLink,iconLink,modifiedTime)',
    );

    return {
      statusCode: 200,
      headers: cors(origin),
      body: JSON.stringify({
        folder: { id: folder.id, name: folder.name, webViewLink: folder.webViewLink },
        files: filesRes.files || [],
      }),
    };
  } catch (e) {
    console.error('drive function error:', e);
    return { statusCode: 500, headers: cors(origin), body: JSON.stringify({ error: 'Erro ao aceder à Drive' }) };
  }
};
