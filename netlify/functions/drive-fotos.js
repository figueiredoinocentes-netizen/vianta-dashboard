// Fotos das viaturas na Drive (pasta CARROS/<viatura>/fotos), só leitura.
//   ?action=folders            -> pastas de viaturas dentro de CARROS
//   ?action=list&folderId=ID   -> imagens da subpasta "fotos" dessa viatura
//   ?action=file&fileId=ID     -> uma imagem (base64), para o browser comprimir e enviar para o Supabase
import convertHeic from 'heic-convert';
import { FOLDER_MIME, driveListAll, getAccessToken, listCarFolders } from '../lib/drive-auth.js';

const PROD_ORIGIN = 'https://vianta-dashboard.netlify.app';
const PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--vianta-dashboard\.netlify\.app$/;
const HEIC_MIMES = ['image/heic', 'image/heif'];
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', ...HEIC_MIMES];
const MAX_DIRECT_BYTES = 4 * 1024 * 1024; // acima disto usa a miniatura grande (limite de 6 MB da função)

const originOf = (event) => {
  const o = (event.headers || {}).origin || (event.headers || {}).Origin;
  return o && (o === PROD_ORIGIN || PREVIEW_ORIGIN_RE.test(o)) ? o : PROD_ORIGIN;
};
const reply = (origin, statusCode, body) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const origin = originOf(event);
  if (event.httpMethod === 'OPTIONS') return reply(origin, 204, '');
  if (event.httpMethod !== 'GET') return reply(origin, 405, { error: 'Method not allowed' });

  const { action, folderId, fileId } = event.queryStringParameters || {};
  try {
    const token = await getAccessToken();

    if (action === 'folders') {
      const folders = await listCarFolders(token);
      return reply(origin, 200, { folders: folders.map((f) => ({ id: f.id, name: f.name })) });
    }

    if (action === 'list') {
      if (!folderId) return reply(origin, 400, { error: 'folderId required' });
      // só pastas que estejam dentro de CARROS
      const cars = await listCarFolders(token);
      if (!cars.some((f) => f.id === folderId)) return reply(origin, 403, { error: 'Pasta fora de CARROS' });
      const subs = await driveListAll(
        token,
        `'${folderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
        'files(id,name)',
      );
      const fotos = subs.find((f) => /^fotos$/i.test(f.name.trim()));
      if (!fotos) return reply(origin, 200, { semFotos: true, files: [] });
      const mimeQ = IMAGE_MIMES.map((m) => `mimeType='${m}'`).join(' or ');
      const files = await driveListAll(
        token,
        `'${fotos.id}' in parents and trashed=false and (${mimeQ})`,
        'files(id,name,mimeType,size)',
      );
      return reply(origin, 200, {
        semFotos: false,
        files: files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
      });
    }

    if (action === 'file') {
      if (!fileId) return reply(origin, 400, { error: 'fileId required' });
      const auth = { Authorization: `Bearer ${token}` };
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=mimeType,size,thumbnailLink&supportsAllDrives=true`,
        { headers: auth },
      );
      if (!metaRes.ok) return reply(origin, 404, { error: 'Ficheiro não encontrado' });
      const meta = await metaRes.json();
      if (!IMAGE_MIMES.includes(meta.mimeType)) return reply(origin, 400, { error: 'Só são permitidas imagens' });

      let res;
      let contentType = meta.mimeType;
      if (Number(meta.size || 0) <= MAX_DIRECT_BYTES || !meta.thumbnailLink) {
        res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
          { headers: auth },
        );
      } else {
        res = await fetch(meta.thumbnailLink.replace(/=s\d+$/, '=s2000'), { headers: auth });
        contentType = 'image/jpeg';
      }
      if (!res.ok) return reply(origin, 502, { error: 'Falha ao ler a imagem' });
      let buf = Buffer.from(await res.arrayBuffer());
      // HEIC/HEIF (fotos de iPhone) não são lidos pelos browsers: converte para JPEG aqui.
      if (HEIC_MIMES.includes(meta.mimeType) && contentType === meta.mimeType) {
        buf = Buffer.from(await convertHeic({ buffer: buf, format: 'JPEG', quality: 0.7 }));
        contentType = 'image/jpeg';
      }
      return reply(origin, 200, { contentType, dataBase64: buf.toString('base64') });
    }

    return reply(origin, 400, { error: 'action inválida' });
  } catch (e) {
    console.error('drive-fotos error:', e);
    return reply(origin, 500, { error: 'Erro ao aceder à Drive' });
  }
};
