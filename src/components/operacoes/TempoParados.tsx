import { useMemo } from 'react';
import { useEstadosLog } from '@/hooks/useOperacoes';
import { useOps } from './OpsContext';
import type { Carro } from '@/lib/operacoes/types';

/** Estados em que a viatura está parada (não gera receita). */
export const ESTADOS_PARADOS = ['Em Preparação', 'Para Aluguer', 'Para Venda', 'Manutenção'] as const;
const DIA = 86_400_000;

/** Dias médios que as viaturas paradas estão no estado atual (a partir do log de estados). */
export function TempoParados({ carros }: { carros: Carro[] }) {
  const { data: log, isError, isLoading } = useEstadosLog();
  const { openVehicle } = useOps();

  const dados = useMemo(() => {
    const agora = Date.now();
    const abertos = new Map((log || []).filter((l) => !l.ate).map((l) => [l.carro_id, l]));
    const linhas = carros
      .filter((c) => (ESTADOS_PARADOS as readonly string[]).includes(c.estado || ''))
      .flatMap((c) => {
        const l = abertos.get(c.id);
        if (!l) return [];
        return [{ carro: c, dias: Math.max(0, Math.floor((agora - new Date(l.desde).getTime()) / DIA)) }];
      });
    const media = (xs: { dias: number }[]) =>
      xs.length ? Math.round(xs.reduce((a, x) => a + x.dias, 0) / xs.length) : null;
    return {
      linhas,
      media: media(linhas),
      porEstado: ESTADOS_PARADOS.map((e) => {
        const xs = linhas.filter((x) => x.carro.estado === e);
        return { estado: e, n: xs.length, media: media(xs) };
      }),
      top: [...linhas].sort((a, b) => b.dias - a.dias).slice(0, 5),
    };
  }, [log, carros]);

  if (isLoading) return null;
  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Tempo parado: o log de estados ainda não existe na base de dados (falta correr a migração).
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Tempo médio parado</div>
        <div className="text-[11px] text-muted-foreground">
          Em preparação, para aluguer, para venda e em manutenção ({dados.linhas.length} viaturas)
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="font-display text-3xl font-bold text-[#fbbf24]">
            {dados.media === null ? '—' : `${dados.media} d`}
          </div>
          <div className="text-[11px] text-muted-foreground">média de dias no estado atual</div>
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
      {!!dados.top.length && (
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="text-[11px] font-medium text-muted-foreground">Mais tempo parados</div>
          {dados.top.map(({ carro, dias }) => (
            <button
              key={carro.id}
              type="button"
              onClick={() => openVehicle(carro.id)}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs transition hover:border-primary"
            >
              <span className="min-w-0 truncate">
                {carro.matricula} · {carro.marca_modelo}{' '}
                <span className="text-muted-foreground">({carro.estado})</span>
              </span>
              <span className="shrink-0 font-semibold">{dias} d</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        O log começou na data da migração; as viaturas já paradas nesse dia contam a partir daí.
      </p>
    </div>
  );
}
