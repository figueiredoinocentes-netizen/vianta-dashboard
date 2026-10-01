import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  driveFolderUrl,
  importarFotosDaPasta,
  listDriveCarFolders,
} from '@/lib/operacoes/central';
import { normalizeText } from '@/lib/operacoes/constants';
import type { Carro } from '@/lib/operacoes/types';
import { errorMessage, useUpdateCarroField } from '@/hooks/useOperacoes';
import { NativeSelect } from './shared';

const folderIdFromLink = (link: string | null | undefined) =>
  (link || '').match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] || '';

/**
 * Fotos da viatura: galeria (coluna `fotos`) e capa (`foto_url`), com importação a partir
 * da pasta CARROS/<viatura>/fotos da Drive. Grava logo, sem esperar pelo "Guardar Alterações".
 */
export function FotosEditor({ carro }: { carro: Carro }) {
  const update = useUpdateCarroField();
  const [busy, setBusy] = useState<string | null>(null);
  const [pasta, setPasta] = useState('');
  const fotos = Array.isArray(carro.fotos) ? carro.fotos : [];

  const folders = useQuery({
    queryKey: ['drive-car-folders'],
    queryFn: listDriveCarFolders,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Pasta já associada à viatura; senão, tenta adivinhar pela matrícula no nome da pasta.
  useEffect(() => {
    if (pasta || !folders.data) return;
    const guardada = folderIdFromLink(carro.fotos_link);
    const plate = normalizeText(carro.matricula).replace(/[^a-z0-9]/g, '');
    const porMatricula = plate
      ? folders.data.find((f) => normalizeText(f.name).replace(/[^a-z0-9]/g, '').includes(plate))
      : undefined;
    setPasta(guardada || porMatricula?.id || '');
  }, [folders.data, carro.fotos_link, carro.matricula, pasta]);

  async function importarDaDrive() {
    if (!pasta) return;
    setBusy('A ler a pasta…');
    try {
      // já importadas: o nome do ficheiro no Supabase leva o id da foto da Drive
      const r = await importarFotosDaPasta(pasta, fotos, (i, n) => setBusy(`A importar ${i}/${n}…`));
      if (r.semFotos) {
        toast.error('Esta pasta não tem subpasta "fotos".');
        return;
      }
      if (r.erro) toast.error(`Erro ao importar: ${r.erro}`);
      if (!r.urls.length && !r.erro) {
        toast.success(r.totalNaPasta ? 'Sem fotos novas para importar.' : 'A pasta "fotos" está vazia.');
      }
      if (r.urls.length) {
        const ok = await update(carro, 'fotos', [...fotos, ...r.urls]);
        if (ok && !carro.foto_url) await update(carro, 'foto_url', r.urls[0]);
        if (ok) toast.success(`${r.urls.length} foto(s) importada(s).`);
      }
      if (driveFolderUrl(pasta) !== carro.fotos_link) await update(carro, 'fotos_link', driveFolderUrl(pasta));
    } catch (err) {
      toast.error(`Erro ao ler a Drive: ${errorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Pasta da Drive (CARROS)</div>
        <div className="flex gap-2">
          <NativeSelect
            className="flex-1"
            value={pasta}
            disabled={!!busy || folders.isLoading}
            onChange={(e) => setPasta(e.target.value)}
          >
            <option value="">
              {folders.isLoading ? 'A carregar pastas…' : folders.isError ? 'Erro ao ler a Drive' : 'Selecionar pasta'}
            </option>
            {(folders.data || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="button" variant="outline" disabled={!pasta || !!busy} onClick={importarDaDrive}>
            <RefreshCw /> {carro.fotos_link ? 'Sincronizar' : 'Importar fotos'}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Importa as imagens da subpasta "fotos" para o ERP. Voltar a sincronizar só traz as fotos novas.
        </p>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Fotos do carro</div>
        {fotos.length > 0 && (
          <div className="mb-2 grid grid-cols-4 gap-2">
            {fotos.map((url) => {
              const capa = url === carro.foto_url;
              return (
                <div
                  key={url}
                  className={cn(
                    'group relative aspect-[4/3] overflow-hidden rounded-md border',
                    capa ? 'border-2 border-primary' : 'border-border',
                  )}
                >
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    title={capa ? 'Foto de capa' : 'Definir como capa'}
                    onClick={() => !capa && update(carro, 'foto_url', url)}
                    className={cn(
                      'absolute left-1 top-1 rounded bg-black/60 p-1',
                      capa ? 'text-primary' : 'text-white/70 hover:text-primary',
                    )}
                  >
                    <Star className="h-3 w-3" fill={capa ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    title="Remover"
                    onClick={() => update(carro, 'fotos', fotos.filter((f) => f !== url))}
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white/70 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {busy || 'A estrela define a foto de capa (a que aparece nos cartões do Stock).'}
        </p>
      </div>
    </div>
  );
}
