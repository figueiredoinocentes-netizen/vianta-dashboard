import { useMemo, useState } from 'react';
import { useEstadosLog, useOcorrencias, useSinistros } from '@/hooks/useOperacoes';
import {
  ESTADOS_PARADOS,
  agruparPorMotivo,
  periodosParados,
  type PeriodoParado,
} from '@/lib/operacoes/parados';
import type { Carro } from '@/lib/operacoes/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOps } from './OpsContext';

export { ESTADOS_PARADOS };

const DIA = 86_400_000;
const media = (xs: { dias: number }[]) =>
  xs.length ? Math.round(xs.reduce((a, x) => a + x.dias, 0) / xs.length) : null;

type Janela = 'agora' | '90d';

/** Tempo parado das viaturas (a partir do log de estados), por estado e por motivo. */
export function TempoParados({ carros }: { carros: Carro[] }) {
  const { data: log, isError, isLoading } = useEstadosLog();
  const { data: sinistros = [] } = useSinistros();
  const { data: ocorrencias = [] } = useOcorrencias();
  const { openVehicle } = useOps();
  const [janela, setJanela] = useState<Janela>('agora');
  const [open, setOpen] = useState(false);

  const dados = useMemo(() => {
    const todos = periodosParados(carros, log || [], sinistros, ocorrencias);
    const limite = Date.now() - 90 * DIA;
    const ps: PeriodoParado[] =
      janela === 'agora' ? todos.filter((p) => p.aberto) : todos.filter((p) => p.aberto || p.fim >= limite);
    return {
      ps,
      media: media(ps),
      porEstado: ESTADOS_PARADOS.map((e) => {
        const xs = ps.filter((x) => x.estado === e);
        return { estado: e, n: xs.length, media: media(xs) };
      }),
      porMotivo: agruparPorMotivo(ps),
      top: todos
        .filter((p) => p.aberto)
        .sort((a, b) => b.dias - a.dias)
        .slice(0, 5),
    };
  }, [log, carros, sinistros, ocorrencias, janela]);

  const agoraMedia = useMemo(
    () => media(periodosParados(carros, log || [], sinistros, ocorrencias).filter((p) => p.aberto)),
    [log, carros, sinistros, ocorrencias],
  );

  if (isLoading) return null;
  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        Tempo parado: o log de estados ainda não existe na base de dados.
      </div>
    );
  }

  const totalDias = dados.porMotivo.reduce((a, g) => a + g.total, 0) || 1;
  const carroDe = (id: number) => carros.find((c) => c.id === id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:-translate-y-px hover:border-primary"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ background: '#fbbf2426', color: '#fbbf24' }}
        >
          ⏱️
        </div>
        <div className="min-w-0">
          <div className="font-display text-2xl font-bold leading-tight" style={{ color: '#fbbf24' }}>
            {agoraMedia === null ? '—' : `${agoraMedia} d`}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-foreground">Tempo médio parado</div>
          <div className="text-[11px] text-muted-foreground">Clique para ver o detalhe</div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Tempo médio parado</DialogTitle>
          </DialogHeader>
          <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Tempo médio parado</div>
          <div className="text-[11px] text-muted-foreground">
            Em preparação, para aluguer, para venda e em manutenção ({dados.ps.length}{' '}
            {janela === 'agora' ? 'viaturas' : 'períodos'})
          </div>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
          {(
            [
              ['agora', 'Agora'],
              ['90d', 'Últimos 90 dias'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setJanela(id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                janela === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="font-display text-3xl font-bold text-[#fbbf24]">
            {dados.media === null ? '—' : `${dados.media} d`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {janela === 'agora' ? 'média no estado atual' : 'média por período parado'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {dados.porEstado.map((e) => (
            <div key={e.estado} className="rounded-lg bg-muted/40 p-2">
              <div className="text-[11px] text-muted-foreground">{e.estado}</div>
              <div className="text-base font-semibold">
                {e.media === null ? '—' : `${e.media} d`}{' '}
                <span className="text-[11px] font-normal text-muted-foreground">({e.n})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <div className="text-[11px] font-medium text-muted-foreground">Por motivo</div>
        {!dados.porMotivo.length ? (
          <p className="text-xs text-muted-foreground">Sem períodos parados nesta janela.</p>
        ) : (
          dados.porMotivo.map((g) => (
            <div key={g.motivo} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{g.motivo}</span>
                <span className="shrink-0 font-semibold">
                  {g.media} d <span className="font-normal text-muted-foreground">({g.n})</span>
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-muted/50">
                <div
                  className="h-full rounded bg-[#fbbf24]/70"
                  style={{ width: `${Math.round((g.total / totalDias) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
        <p className="text-[11px] text-muted-foreground">
          A barra mostra o peso de cada motivo no total de dias parados.
        </p>
      </div>

      {!!dados.top.length && (
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="text-[11px] font-medium text-muted-foreground">Mais tempo parados</div>
          {dados.top.map((p) => {
            const carro = carroDe(p.carroId);
            return (
              <button
                key={p.carroId}
                type="button"
                onClick={() => {
                  setOpen(false);
                  openVehicle(p.carroId);
                }}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs transition hover:border-primary"
              >
                <span className="min-w-0 truncate">
                  {carro?.matricula} · {carro?.marca_modelo}{' '}
                  <span className="text-muted-foreground">({p.motivo})</span>
                </span>
                <span className="shrink-0 font-semibold">{p.dias} d</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        O log começou na data da migração; as viaturas já paradas nesse dia contam a partir daí (exceto
        sinistros, que contam desde a data de início do sinistro).
      </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
