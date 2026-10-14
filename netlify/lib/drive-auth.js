// Autenticação por service account (JWT bearer, sem dependências) e helpers da Drive,
// partilhados pelas funções que leem a pasta CARROS.
// Criação de ficheiros: a service account pode ter quota 0 — usa-se OAuth de utilizador
// (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN) quando disponível (ver getUserAccessToken).
import crypto from 'node:crypto';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_WRITE_SCOPE = 'https://www.googleapis.com/auth/drive';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

const b64url = (input) => Buffer.from(input).toString('base64url');

export async function getAccessToken(scope = DRIVE_SCOPE) {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT must be set');
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ iss: sa.client_email, scope, aud: sa.token_uri, exp: now + 3600, iat: now }),
  )}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Access token de utilizador (OAuth refresh). Usado para criar ficheiros quando a
 *  service account não tem quota de armazenamento. Requer env vars GOOGLE_CLIENT_ID,
 *  GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN no Netlify. */
export async function getUserAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) {
    throw new Error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN must be set');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

export async function driveList(token, q, fields, pageToken) {
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent(fields)}&pageSize=200&orderBy=name` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
    (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive API failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function driveListAll(token, q, fields) {
  const out = [];
  let pageToken;
  do {
    const r = await driveList(token, q, `nextPageToken,${fields}`, pageToken);
    out.push(...(r.files || []));
    pageToken = r.nextPageToken;
  } while (pageToken && out.length < 400);
  return out;
}

/** Subpastas diretas de CARROS (uma por viatura). */
export async function listCarFolders(token) {
  const rootRes = await driveList(
    token,
    "name='CARROS' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    'files(id,name)',
  );
  const root = rootRes.files && rootRes.files[0];
  if (!root) throw new Error('Pasta CARROS não encontrada (verificar partilha com a service account)');
  return driveListAll(token, `'${root.id}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`, 'files(id,name)');
}

/** Conteúdo binário de um ficheiro da Drive (Buffer). */
export async function driveDownload(token, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
