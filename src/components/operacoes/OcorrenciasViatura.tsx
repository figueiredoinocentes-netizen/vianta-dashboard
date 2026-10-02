import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCentralField, uploadFoto } from '@/lib/operacoes/central';
import { eur, semIva } from '@/lib/operacoes/custos';
import type { Carro, Ocorrencia } from '@/lib/operacoes/types';
import {
  errorMessage,
  useCentralWrites,
  useFinanceiro,
  useOcorrencias,
  useRefreshOperacoes,
} from '@/hooks/useOperacoes';
import { NovoMovimento } from './CustosViatura';
import { Field, NativeSelect } from './shared';

export const TIPOS_OCORRENCIA = ['Dano', 'Avaria', 'Aviso', 'Outro'] as const;
export const GRAVIDADES = ['Baixa', 'Média', 'Alta'] as const;
export const ESTADOS_OCORRENCIA = ['Por resolver', 'Em reparação', 'Resolvido'] as const;

export const gravidadeClass = (g: string | null) =>
  g === 'Alta'
    ? 'bg-red-500/15 text-red-300'
    : g === 'Média'
      ? 'bg-amber-500/15 text-amber-300'
      : 'bg-muted text-muted-foreground';

const hoje = () => new Date().toISOString().slice(0, 10);

/** Ocorrências (danos, avarias, avisos) de uma viatura, com fotos e custo da reparação. */
export function OcorrenciasViatura({ carro, reportadoPor }: { carro: Carro; reportadoPor?: string }) {
  const { data: todas = [], isLoading } = useOcorrencias();
  const { data: movs = [] } = useFinanceiro();
  const { create, remove } = useCentralWrites('ocorrencias');
  const createMov = useCentralWrites('financeiro').create;
  const refresh = useRefreshOperacoes();
  const [adding, setAdding] = useState(false);
  const [costFor, setCostFor] = useState<number | null>(null);

  const lista = useMemo(
    () =>
      todas
        .filter((o) => o.carro_id === carro.id)
        .sort((a, b) => {
          const pend = (o: Ocorrencia) => (o.estado === 'Resolvido' ? 1 : 0);
          return pend(a) - pend(b) || String(b.data || '').localeCompare(String(a.data || ''));
        }),
    [todas, carro.id],
  );

  async function setEstado(o: Ocorrencia, estado: string) {
    try {
      await updateCentralField('ocorrencias', o.id, 'estado', estado);
      await updateCentralField('ocorrencias', o.id, 'resolvido_em', estado === 'Resolvido' ? hoje() : null);
      refresh();
    } catch (e) {
      toast.error(`Erro ao guardar: ${errorMessage(e)}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          Danos, avarias e avisos desta viatura
        </div>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            + Registar
          </Button>
        )}
      </div>

      {adding && (
        <NovaOcorrencia
          carro={carro}
          reportadoPor={reportadoPor}
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSave={async (body) => {
            await create.mutateAsync(body);
            setAdding(false);
            toast.success('Ocorrência registada');
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !lista.length ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Sem ocorrências registadas nesta viatura.
        </p>
      ) : (
        lista.map((o) => {
          const custos = movs.filter((m) => m.ocorrencia_id === o.id);
          const total = -custos.reduce((a, m) => a + semIva(m), 0);
          return (
            <div key={o.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {o.tipo || 'Ocorrência'}
                    <span className={`rounded px-1.5 py-0.5 text-[11px] ${gravidadeClass(o.gravidade)}`}>
                      {o.gravidade}
                    </span>
                  </div>
                  {o.descricao && <div className="mt-0.5 text-sm text-foreground/80">{o.descricao}</div>}
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {o.data}
                    {o.reportado_por ? ` · ${o.reportado_por}` : ''}
                    {o.resolvido_em ? ` · resolvido a ${o.resolvido_em}` : ''}
                  </div>
                </div>
                <NativeSelect
                  className="h-8 w-auto text-xs"
                  value={o.estado || 'Por resolver'}
                  onChange={(e) => setEstado(o, e.target.value)}
                >
                  {ESTADOS_OCORRENCIA.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </NativeSelect>
              </div>

              {!!o.fotos?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.fotos.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                      <img src={u} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Custo da reparação:{' '}
                  <span className="font-semibold text-foreground">{custos.length ? eur(total) : '—'}</span>
                </span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setCostFor(costFor === o.id ? null : o.id)}
                  >
                    + custo da reparação
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm('Apagar esta ocorrência? Os custos registados ficam.')) remove.mutate(o.id);
                    }}
                  >
                    apagar
                  </button>
                </span>
              </div>

              {costFor === o.id && (
                <div className="mt-2">
                  <NovoMovimento
                    carro={carro}
                    busy={createMov.isPending}
                    defaultCategoria="Manutenção"
                    defaultDescricao={`${o.tipo || 'Ocorrência'}: ${o.descricao || ''}`.trim()}
                    extra={{ ocorrencia_id: o.id }}
                    onCancel={() => setCostFor(null)}
                    onSave={async (body) => {
                      await createMov.mutateAsync(body);
                      setCostFor(null);
                      toast.success('Custo registado');
                    }}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function NovaOcorrencia({
  carro,
  reportadoPor,
  busy,
  onSave,
  onCancel,
}: {
  carro: Carro;
  reportadoPor?: string;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<string>(TIPOS_OCORRENCIA[0]);
  const [gravidade, setGravidade] = useState<string>('Média');
  const [descricao, setDescricao] = useState('');
  const [quem, setQuem] = useState(reportadoPor || '');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!descricao.trim() && !files.length) return toast.error('Descreva a ocorrência ou junte uma foto.');
    setSending(true);
    try {
      const fotos: string[] = [];
      for (const f of files) fotos.push(await uploadFoto(f, `ocorrencia-${carro.id}`));
      await onSave({
        carro_id: carro.id,
        tipo,
        gravidade,
        descricao: descricao.trim() || null,
        reportado_por: quem.trim() || null,
        fotos,
      });
    } catch (e) {
      toast.error(`Erro ao registar: ${errorMessage(e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="grid grid-cols-2 gap-3 rounded-lg border border-primary/40 bg-muted/30 p-3"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
    >
      <Field label="Tipo">
        <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_OCORRENCIA.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Gravidade">
        <NativeSelect value={gravidade} onChange={(e) => setGravidade(e.target.value)}>
          {GRAVIDADES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="O que se passa / o que é preciso fazer" className="col-span-2">
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="ex.: risco no para-choques traseiro, lado esquerdo"
        />
      </Field>
      <Field label="Reportado por" className="col-span-2">
        <Input value={quem} onChange={(e) => setQuem(e.target.value)} />
      </Field>
      <Field label="Fotos" className="col-span-2">
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        {!!files.length && (
          <p className="mt-1 text-[11px] text-muted-foreground">{files.length} foto(s) selecionada(s)</p>
        )}
      </Field>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" disabled={busy || sending} onClick={submit}>
          {sending ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
