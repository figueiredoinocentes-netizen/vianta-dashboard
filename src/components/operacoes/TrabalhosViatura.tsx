import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCentralField, uploadFoto } from '@/lib/operacoes/central';
import { eur, semIva } from '@/lib/operacoes/custos';
import {
  ESTADOS_TRABALHO,
  GRAVIDADES,
  ORIGEM_OCORR,
  ORIGEM_PREP,
  TIPOS_COM_GRAVIDADE,
  TIPOS_TRABALHO,
  categoriaDoTrabalho,
  concluido,
  ePreparacao,
  gravidadeClass,
} from '@/lib/operacoes/trabalhos';
import type { Carro, Ocorrencia } from '@/lib/operacoes/types';
import {
  errorMessage,
  useCentralWrites,
  useFinanceiro,
  useOcorrencias,
  useRefreshOperacoes,
} from '@/hooks/useOperacoes';
import { NovoMovimento } from './NovoMovimento';
import { Field, NativeSelect } from './shared';

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Trabalhos de uma viatura: itens da preparação (checklist "A Fazer") e ocorrências
 * (danos, avarias, avisos). Cada um tem estado, fotos opcionais e custos ligados.
 */
export function TrabalhosViatura({ carro }: { carro: Carro }) {
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
          const fim = (o: Ocorrencia) => (concluido(o) ? 1 : 0);
          const org = (o: Ocorrencia) => (ePreparacao(o) ? 1 : 0);
          return (
            fim(a) - fim(b) ||
            org(a) - org(b) ||
            (ePreparacao(a) ? a.id - b.id : String(b.data || '').localeCompare(String(a.data || '')))
          );
        }),
    [todas, carro.id],
  );

  const custoDe = (o: Ocorrencia) => {
    const cs = movs.filter((m) => m.ocorrencia_id === o.id);
    return { n: cs.length, total: -cs.reduce((a, m) => a + semIva(m), 0) };
  };
  const prep = lista.filter(ePreparacao);
  const prepFeitos = prep.filter(concluido).length;
  const custoPrep = prep.reduce((a, o) => a + custoDe(o).total, 0);
  const custoOcorr = lista.filter((o) => !ePreparacao(o)).reduce((a, o) => a + custoDe(o).total, 0);

  async function setEstado(o: Ocorrencia, estado: string) {
    try {
      await updateCentralField('ocorrencias', o.id, 'estado', estado);
      await updateCentralField('ocorrencias', o.id, 'resolvido_em', estado === 'Feito' ? hoje() : null);
      refresh();
      // Ao dar como feito, pergunta o custo (pode ficar sem custo).
      if (estado === 'Feito' && !custoDe(o).n) setCostFor(o.id);
      else if (costFor === o.id && estado !== 'Feito') setCostFor(null);
    } catch (e) {
      toast.error(`Erro ao guardar: ${errorMessage(e)}`);
    }
  }

  async function addFotos(o: Ocorrencia, files: File[]) {
    if (!files.length) return;
    try {
      const novas: string[] = [];
      for (const f of files) novas.push(await uploadFoto(f, `ocorrencia-${carro.id}`));
      await updateCentralField('ocorrencias', o.id, 'fotos', [...(o.fotos || []), ...novas]);
      refresh();
    } catch (e) {
      toast.error(`Erro ao enviar fotos: ${errorMessage(e)}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Tarefas e ocorrências</div>
          <div className="text-[11px] text-muted-foreground">
            {prep.length ? `Preparação: ${prepFeitos}/${prep.length} · ${eur(custoPrep)} · ` : ''}
            Outras tarefas: {eur(custoOcorr)} (s/ IVA)
          </div>
        </div>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            + Registar
          </Button>
        )}
      </div>

      {adding && (
        <NovoTrabalho
          carro={carro}
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSave={async (body) => {
            const rows = (await create.mutateAsync(body)) as { id?: number }[];
            setAdding(false);
            toast.success('Registado');
            // Já feito e sem custo registado: pergunta logo o custo.
            if (body.estado === 'Feito' && rows[0]?.id) setCostFor(rows[0].id);
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !lista.length ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Sem trabalhos nem ocorrências nesta viatura.
          {carro.estado === 'Em Preparação' && ' Os itens da preparação são criados automaticamente.'}
        </p>
      ) : (
        lista.map((o) => {
          const c = custoDe(o);
          const prepTask = ePreparacao(o);
          const feito = concluido(o);
          return (
            <div
              key={o.id}
              className={'rounded-lg border border-border bg-card p-3 ' + (feito ? 'opacity-70' : '')}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className={o.estado === 'Dispensado' ? 'line-through' : ''}>
                      {prepTask ? o.descricao || o.item : o.tipo || 'Ocorrência'}
                    </span>
                    {prepTask ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-normal text-primary">
                        {o.tipo} · preparação
                      </span>
                    ) : (
                      TIPOS_COM_GRAVIDADE.includes(o.tipo || '') && (
                        <span className={`rounded px-1.5 py-0.5 text-[11px] ${gravidadeClass(o.gravidade)}`}>
                          {o.gravidade}
                        </span>
                      )
                    )}
                  </div>
                  {!prepTask && o.descricao && (
                    <div className="mt-0.5 text-sm text-foreground/80">{o.descricao}</div>
                  )}
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {o.data}
                    {o.reportado_por ? ` · ${o.reportado_por}` : ''}
                    {o.resolvido_em ? ` · feito a ${o.resolvido_em}` : ''}
                  </div>
                </div>
                <NativeSelect
                  className="h-8 w-auto text-xs"
                  value={o.estado || 'Por fazer'}
                  onChange={(e) => setEstado(o, e.target.value)}
                >
                  {ESTADOS_TRABALHO.map((s) => (
                    <option key={s} value={s}>
                      {s === 'Dispensado' ? 'Não se aplica' : s}
                    </option>
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
                  Custo: <span className="font-semibold text-foreground">{c.n ? eur(c.total) : '—'}</span>
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer text-primary hover:underline">
                    + foto
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addFotos(o, Array.from(e.target.files || []));
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setCostFor(costFor === o.id ? null : o.id)}
                  >
                    + custo
                  </button>
                  {!prepTask && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (window.confirm('Apagar esta ocorrência? Os custos registados ficam.')) remove.mutate(o.id);
                      }}
                    >
                      apagar
                    </button>
                  )}
                </span>
              </div>

              {costFor === o.id && (
                <div className="mt-2">
                  <NovoMovimento
                    carro={carro}
                    busy={createMov.isPending}
                    cancelLabel={feito && !c.n ? 'Sem custo' : 'Cancelar'}
                    defaultCategoria={categoriaDoTrabalho(o.tipo, o.origem)}
                    defaultDescricao={o.descricao || o.item || o.tipo || ''}
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

function NovoTrabalho({
  carro,
  busy,
  onSave,
  onCancel,
}: {
  carro: Carro;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [origem, setOrigem] = useState<string>(carro.estado === 'Em Preparação' ? ORIGEM_PREP : ORIGEM_OCORR);
  const [tipo, setTipo] = useState<string>(TIPOS_TRABALHO[0]);
  const [gravidade, setGravidade] = useState<string>('Média');
  const [descricao, setDescricao] = useState('');
  const [quem, setQuem] = useState('');
  const [jaFeito, setJaFeito] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!descricao.trim() && !files.length) return toast.error('Descreva o trabalho ou junte uma foto.');
    setSending(true);
    try {
      const fotos: string[] = [];
      for (const f of files) fotos.push(await uploadFoto(f, `ocorrencia-${carro.id}`));
      await onSave({
        carro_id: carro.id,
        origem,
        tipo,
        gravidade: origem === ORIGEM_OCORR && TIPOS_COM_GRAVIDADE.includes(tipo) ? gravidade : 'Baixa',
        estado: jaFeito ? 'Feito' : 'Por fazer',
        resolvido_em: jaFeito ? new Date().toISOString().slice(0, 10) : null,
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
      <Field label="Origem">
        <NativeSelect value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value={ORIGEM_OCORR}>Ocorrência ou outra tarefa</option>
          <option value={ORIGEM_PREP}>Preparação</option>
        </NativeSelect>
      </Field>
      <Field label="Tipo">
        <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_TRABALHO.map((t) => (
            <option key={t}>{t}</option>
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
      {origem === ORIGEM_OCORR && TIPOS_COM_GRAVIDADE.includes(tipo) && (
        <Field label="Gravidade">
          <NativeSelect value={gravidade} onChange={(e) => setGravidade(e.target.value)}>
            {GRAVIDADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field
        label="Reportado por"
        className={origem === ORIGEM_OCORR && TIPOS_COM_GRAVIDADE.includes(tipo) ? '' : 'col-span-2'}
      >
        <Input value={quem} onChange={(e) => setQuem(e.target.value)} />
      </Field>
      <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={jaFeito}
          onChange={(e) => setJaFeito(e.target.checked)}
          className="accent-[hsl(var(--primary))]"
        />
        Já está feito (registar o custo a seguir)
      </label>
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
