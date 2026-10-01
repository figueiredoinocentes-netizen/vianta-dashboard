// Cliente da API "central" (Netlify Function → Supabase) e das funções de
// ficheiros (Google Drive, fotos). Único sítio que faz fetch na Operações.
import type { DriveListing } from './types';

const BASE = '/.netlify/functions';

export type CentralType =
  | 'carros'
  | 'armazem'
  | 'motoristas'
  | 'investidores'
  | 'clientes'
  | 'pagamentos';

async function readJson(r: Response) {
  return r.json().catch(() => ({}));
}

async function assertOk(r: Response) {
  if (r.ok) return readJson(r);
  const d = await readJson(r);
  throw new Error((d as { error?: string }).error || String(r.status));
}

export async function listCentral<T>(type: CentralType): Promise<T[]> {
  const r = await fetch(`${BASE}/central?type=${type}`, {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error('Erro ao carregar dados');
  return r.json();
}

export async function createCentral<T = { id: number }>(
  type: CentralType,
  body: Record<string, unknown>,
): Promise<T[]> {
  const r = await fetch(`${BASE}/central?type=${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await assertOk(r);
  return Array.isArray(d) ? (d as T[]) : [];
}

export async function updateCentralField(
  type: CentralType,
  id: number,
  field: string,
  value: unknown,
): Promise<void> {
  const r = await fetch(`${BASE}/central?type=${type}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, field, value }),
  });
  await assertOk(r);
}

export async function deleteCentral(type: CentralType, id: number): Promise<void> {
  const r = await fetch(`${BASE}/central?type=${type}&id=${id}`, { method: 'DELETE' });
  await assertOk(r);
}

// ── Fotos de viaturas (Supabase Storage) ──

// Redimensiona a imagem no browser antes de enviar (mantém o payload pequeno).
function compressImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFoto(file: File, prefix?: string): Promise<string> {
  const dataUrl = await compressImage(file, 1280, 0.75);
  const dataBase64 = dataUrl.split(',')[1];
  const r = await fetch(`${BASE}/upload-foto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: 'image/jpeg', dataBase64, prefix }),
  });
  const d = await readJson(r);
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro ao enviar imagem');
  return (d as { url: string }).url;
}

// ── Documentos da viatura (Google Drive) ──

export async function listDriveFiles(
  matricula: string,
  modelo: string,
  folderId?: string,
): Promise<DriveListing> {
  const params = new URLSearchParams({ matricula, modelo });
  if (folderId) params.set('folderId', folderId);
  const r = await fetch(`${BASE}/drive?${params.toString()}`);
  if (!r.ok) return { files: [], folder: null };
  const d = await readJson(r);
  return {
    files: (d as Partial<DriveListing>).files || [],
    folder: (d as Partial<DriveListing>).folder || null,
  };
}

export async function uploadDriveDoc(args: {
  folderId: string;
  filename: string;
  contentType: string;
  file: File;
}): Promise<void> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(args.file);
  });
  const r = await fetch(`${BASE}/drive-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderId: args.folderId,
      filename: args.filename,
      contentType: args.contentType,
      dataBase64,
    }),
  });
  const d = await readJson(r);
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro ao enviar');
}

// ── Fotos na Drive (CARROS/<viatura>/fotos) → Supabase Storage ──

export interface DriveCarFolder {
  id: string;
  name: string;
}

export interface DriveFoto {
  id: string;
  name: string;
  mimeType: string;
}

export async function listDriveCarFolders(): Promise<DriveCarFolder[]> {
  const r = await fetch(`${BASE}/drive-fotos?action=folders`);
  const d = await readJson(r);
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro ao ler a Drive');
  return (d as { folders: DriveCarFolder[] }).folders;
}

export async function listDriveFotos(folderId: string): Promise<{ semFotos: boolean; files: DriveFoto[] }> {
  const r = await fetch(`${BASE}/drive-fotos?action=list&folderId=${encodeURIComponent(folderId)}`);
  const d = await readJson(r);
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro ao ler a Drive');
  return d as { semFotos: boolean; files: DriveFoto[] };
}

/** Descarrega uma foto da Drive, comprime-a e envia-a para o Supabase. Devolve o URL público. */
export async function importarFotoDaDrive(foto: DriveFoto): Promise<string> {
  const r = await fetch(`${BASE}/drive-fotos?action=file&fileId=${encodeURIComponent(foto.id)}`);
  const d = await readJson(r);
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro ao ler a foto');
  const { dataBase64, contentType } = d as { dataBase64: string; contentType: string };
  const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
  const file = new File([bytes], foto.name, { type: contentType });
  return uploadFoto(file, `drive-${foto.id}`);
}

/**
 * Importa para o Supabase as fotos novas da subpasta "fotos" de uma pasta da Drive.
 * `existentes` = URLs já na galeria (para não duplicar). Devolve os URLs novos.
 */
export async function importarFotosDaPasta(
  folderId: string,
  existentes: string[],
  onProgress?: (feitas: number, total: number) => void,
): Promise<{ semFotos: boolean; totalNaPasta: number; urls: string[]; erro?: string }> {
  const { semFotos, files } = await listDriveFotos(folderId);
  if (semFotos) return { semFotos: true, totalNaPasta: 0, urls: [] };
  const novas = files.filter((f) => !existentes.some((u) => u.includes(`drive-${f.id}-`)));
  const urls: string[] = [];
  let erro: string | undefined;
  try {
    for (const [i, f] of novas.entries()) {
      onProgress?.(i + 1, novas.length);
      urls.push(await importarFotoDaDrive(f));
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
  }
  return { semFotos: false, totalNaPasta: files.length, urls, erro };
}

export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
