import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCentralField } from '@/lib/operacoes/central';
import { eur } from '@/lib/operacoes/custos';
import { ORIGEM_OCORR, TIPOS_TRABALHO, ePreparacao } from '@/lib/operacoes/trabalhos';
import type { Carro, Sinistro } from '@/lib/operacoes/types';
import {
  errorMessage,
  useCentralWrites,
  useOcorrencias,
  useRefreshOperacoes,
  useSinistros,
} from '@/hooks/useOperacoes';
import { DateField } from './DateField';
import { DeleteConfirm, Field, NativeSelect } from './shared';

const hoje = () => new Date().toISOString().slice(0, 10);
const fmtData = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const dias = (a: string | null, b: string | null) => {
  if (!a) return null;
  const fim = b ? new Date(b) : new Date();
  return Math.max(0, Math.round((fim.getTime() - new Date(a).getTime()) / 86_400_000));
};
const parseValor = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);

/**
 * Histórico de sinistros de uma viatura. Cada sinistro tem datas (chegada ao gestor de frota
 * → resolução), orçamento do seguro e as manutenções (`ocorrencias`) ligadas a ele.
 */
export function SinistrosViatura({ carro }: { carro: Carro }) {
  const { data: todos = [], isLoading } = useSinistros();
  const { data: ocorrencias = [] } = useOcorrencias();
  const { create, remove } = useCentralWrites('sinistros');
  const criarManut = useCentralWrites('ocorrencias').create;
  const refresh = useRefreshOperacoes();
  const [novaManut, setNovaManut] = useState<{ sid: number; tipo: string; descricao: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ data_inicio: hoje(), orcamento: '', descricao: '' });

  const lista = useMemo(
    () =>
      todos
        .filter((s) => s.carro_id === carro.id)
        .sort(
          (a, b) =>
            String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')) || b.id - a.id,
        ),
    [todos, carro.id],
  );
  // Manutenções desta viatura (a preparação não conta).
  const manutencoes = ocorrencias.filter((o) => o.carro_id === carro.id && !ePreparacao(o));

  async function guardar() {
    const orc = parseValor(form.orcamento);
    if (orc !== null && Number.isNaN(orc)) return toast.error('Orçamento inválido');
    try {
      await create.mutateAsync({
        carro_id: carro.id,
        data_inicio: form.data_inicio || hoje(),
        orcamento_seguro: orc,
        descricao: form.descricao.trim() || null,
      });
      setAdding(false);
      setForm({ data_inicio: hoje(), orcamento: '', descricao: '' });
      toast.success('Sinistro registado');
    } catch (e) {
      toast.error(`Erro ao guardar: ${errorMessage(e)}`);
    }
  }

  async function setField(s: Sinistro, field: string, value: unknown) {
    try {
      await updateCentralField('sinistros', s.id, field, value);
      refresh();
    } catch (e) {
      toast.error(`Erro ao guardar: ${errorMessage(e)}`);
    }
  }

  async function ligar(ocorrenciaId: number, sinistroId: number | null) {
    try {
      await updateCentralField('ocorrencias', ocorrenciaId, 'sinistro_id', sinistroId);
      refresh();
    } catch (e) {
      toast.error(`Erro ao ligar manutenção: ${errorMessage(e)}`);
    }
  }

  async function criarManutencao() {
    if (!novaManut) return;
    try {
      await criarManut.mutateAsync({
        carro_id: carro.id,
        sinistro_id: novaManut.sid,
        origem: ORIGEM_OCORR,
        tipo: novaManut.tipo,
        descricao: novaManut.descricao.trim() || null,
        gravidade: 'Média',
        estado: 'Por fazer',
        data: hoje(),
      });
      setNovaManut(null);
      toast.success('Manutenção criada e ligada');
    } catch (e) {
      toast.error(`Erro ao criar manutenção: ${errorMessage(e)}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          Histórico de sinistros ({lista.length})
        </div>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            + Novo sinistro
          </Button>
        )}
      </div>

      {adding && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
          <Field label="Data de início (chegada ao gestor de frota)">
            <DateField
              value={form.data_inicio}
              onChange={(v) => setForm((f) => ({ ...f, data_inicio: v }))}
            />
          </Field>
          <Field label="Orçamento do seguro (€)">
            <Input
              inputMode="decimal"
              value={form.orcamento}
              onChange={(e) => setForm((f) => ({ ...f, orcamento: e.target.value }))}
            />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={create.isPending} onClick={guardar}>
              Guardar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !lista.length ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Sem sinistros registados nesta viatura.
        </p>
      ) : (
        lista.map((s) => {
          const ligadas = manutencoes.filter((o) => o.sinistro_id === s.id);
          const livres = manutencoes.filter((o) => !o.sinistro_id);
          const aberto = !s.data_fim;
          const d = dias(s.data_inicio, s.data_fim);
          const orc = s.orcamento_seguro == null ? null : Number(s.orcamento_seguro);
          return (
            <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {s.descricao || 'Sinistro'}{' '}
                  <span
                    className={
                      'ml-1 rounded px-1.5 py-0.5 text-[11px] ' +
                      (aberto
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-emerald-500/15 text-emerald-300')
                    }
                  >
                    {aberto ? 'Em aberto' : 'Resolvido'}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtData(s.data_inicio)} → {fmtData(s.data_fim)}
                  {d !== null && ` · ${d} dias`}
                  {orc !== null && ` · ${eur(orc)}`}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Início">
                  <DateField
                    value={s.data_inicio || ''}
                    onChange={(v) => v && v !== s.data_inicio && setField(s, 'data_inicio', v)}
                  />
                </Field>
                <Field label="Fim (resolvido)">
                  <DateField
                    clearable
                    value={s.data_fim || ''}
                    onChange={(v) => setField(s, 'data_fim', v || null)}
                  />
                </Field>
                <Field label="Orçamento do seguro (€)">
                  <Input
                    inputMode="decimal"
                    defaultValue={s.orcamento_seguro ?? ''}
                    onBlur={(e) => {
                      const n = parseValor(e.target.value);
                      if (n !== null && Number.isNaN(n)) return toast.error('Orçamento inválido');
                      if (n !== orc) setField(s, 'orcamento_seguro', n);
                    }}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-medium text-muted-foreground">
                  Manutenções ligadas ({ligadas.length})
                </div>
                {ligadas.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      {fmtData(o.data)} · {o.tipo}: {o.descricao || 'sem descrição'} · {o.estado}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => ligar(o.id, null)}
                    >
                      Desligar
                    </button>
                  </div>
                ))}
                {!ligadas.length && !livres.length && (
                  <p className="text-xs text-muted-foreground">
                    Esta viatura ainda não tem manutenções registadas. Cria uma abaixo.
                  </p>
                )}
                {novaManut?.sid === s.id ? (
                  <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-3">
                    <NativeSelect
                      value={novaManut.tipo}
                      onChange={(e) => setNovaManut({ ...novaManut, tipo: e.target.value })}
                    >
                      {TIPOS_TRABALHO.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      className="sm:col-span-2"
                      placeholder="Descrição"
                      value={novaManut.descricao}
                      onChange={(e) => setNovaManut({ ...novaManut, descricao: e.target.value })}
                    />
                    <div className="flex justify-end gap-2 sm:col-span-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setNovaManut(null)}>
                        Cancelar
                      </Button>
                      <Button type="button" size="sm" disabled={criarManut.isPending} onClick={criarManutencao}>
                        Criar e ligar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setNovaManut({ sid: s.id, tipo: 'Mecânica', descricao: '' })}
                  >
                    + Nova manutenção
                  </Button>
                )}
                {!!livres.length && (
                  <NativeSelect
                    value=""
                    onChange={(e) => e.target.value && ligar(Number(e.target.value), s.id)}
                  >
                    <option value="">+ Ligar manutenção existente…</option>
                    {livres.map((o) => (
                      <option key={o.id} value={o.id}>
                        {fmtData(o.data)} · {o.tipo}: {o.descricao || 'sem descrição'}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </div>

              <div className="flex justify-end">
                <DeleteConfirm
                  label="Eliminar sinistro"
                  busy={remove.isPending}
                  onConfirm={() =>
                    remove.mutateAsync(s.id).catch((e) => toast.error(errorMessage(e)))
                  }
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
