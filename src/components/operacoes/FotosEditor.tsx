import { useState } from 'react';
import { toast } from 'sonner';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFoto } from '@/lib/operacoes/central';
import type { Carro } from '@/lib/operacoes/types';
import { errorMessage, useUpdateCarroField } from '@/hooks/useOperacoes';

/**
 * Fotos da viatura: várias fotos (coluna `fotos`) e escolha da capa (`foto_url`).
 * Grava logo ao carregar/remover, sem esperar pelo botão "Guardar Alterações".
 */
export function FotosEditor({ carro }: { carro: Carro }) {
  const update = useUpdateCarroField();
  const [busy, setBusy] = useState<string | null>(null);
  const fotos = Array.isArray(carro.fotos) ? carro.fotos : [];

  async function adicionar(files: FileList | null) {
    if (!files?.length) return;
    const novas: string[] = [];
    try {
      for (const [i, file] of Array.from(files).entries()) {
        setBusy(`A enviar ${i + 1}/${files.length}…`);
        novas.push(await uploadFoto(file));
      }
    } catch (err) {
      toast.error(`Erro ao enviar imagem: ${errorMessage(err)}`);
    }
    if (novas.length) {
      const ok = await update(carro, 'fotos', [...fotos, ...novas]);
      if (ok && !carro.foto_url) await update(carro, 'foto_url', novas[0]);
    }
    setBusy(null);
  }

  return (
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
                <img src={url} alt="" className="h-full w-full object-cover" />
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
      <label className="inline-block cursor-pointer rounded border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary">
        {busy || '📤 Adicionar fotos'}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={!!busy}
          onChange={(e) => {
            adicionar(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">
        A estrela define a foto de capa (a que aparece nos cartões do Stock).
      </p>
    </div>
  );
}
