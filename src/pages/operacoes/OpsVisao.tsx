import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getStats, parseEuros } from '@/lib/operacoes/constants';
import { useCarros } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { ErrorBox, OpsHeader } from '@/components/operacoes/shared';
import { MargensFrota } from '@/components/operacoes/MargensFrota';

function Kpi({
  icon,
  color,
  value,
  label,
  sub,
}: {
  icon: string;
  color: string;
  value: ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:-translate-y-px hover:border-border/80">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
        style={{ background: `${color}26`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-bold leading-tight" style={{ color }}>
          {value}
        </div>
        <div className="mt-0.5 text-xs font-semibold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

export default function OpsVisao() {
  const { openNovaViatura } = useOps();
  const { data: carros = [], isLoading, isError } = useCarros();
  const s = getStats(carros);
  const alugados = carros.filter((v) => v.estado === 'Alugado' && v.tipo_gestao !== 'Slot');
  const renda = alugados.reduce((sum, v) => sum + parseEuros(v.valor_aluguer_semanal) * 4.33, 0);

  return (
    <>
      <OpsHeader
        title="📊 Visão Geral"
        count={s.total}
        newLabel="Nova Viatura"
        onNew={openNovaViatura}
        showSearch={false}
      />
      {isError ? (
        <ErrorBox text="Erro ao carregar a frota." />
      ) : isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <Kpi icon="🚗" color="#6ee7b7" value={alugados.length} label="Frota Ativa" sub="Alugados na rua" />
            <Kpi icon="🏪" color="#93c5fd" value={s.stock} label="Em Stock" sub="Para venda / aluguer" />
            <Kpi
              icon="🔧"
              color="#fbbf24"
              value={s.inativos + s.manutencao}
              label="Parados"
              sub="Inativo + Manutenção"
            />
            <Kpi icon="💰" color="#9ca3af" value={s.vendidos} label="Vendidos" sub="Este ano" />
            <Kpi
              icon="📈"
              color="#22c55e"
              value={`€${Math.round(renda).toLocaleString()}`}
              label="Receita Aluguer/mês"
              sub={`Estimada (${alugados.length} alugados)`}
            />
            <Kpi icon="🚘" color="#60a5fa" value={s.total} label="Total Frota" sub="Todas as viaturas" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            {[
              ['Proprietário VIANTA', carros.filter((v) => v.proprietario === 'VIANTA').length],
              [
                'Investidores',
                carros.filter(
                  (v) => v.proprietario && v.proprietario !== 'VIANTA' && v.tipo_gestao !== 'Slot',
                ).length,
              ],
              ['Slot', carros.filter((v) => v.tipo_gestao === 'Slot').length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-1 text-xs text-muted-foreground">{label}</div>
                <div className="font-display text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>
          <MargensFrota carros={carros} />
        </div>
      )}
    </>
  );
}
