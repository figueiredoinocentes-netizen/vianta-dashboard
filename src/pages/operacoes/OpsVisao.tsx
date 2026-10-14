import { Skeleton } from '@/components/ui/skeleton';
import { getStats, parseEuros } from '@/lib/operacoes/constants';
import { useCarros } from '@/hooks/useOperacoes';
import { useOps } from '@/components/operacoes/OpsContext';
import { ErrorBox, OpsHeader } from '@/components/operacoes/shared';
import { MargensFrota } from '@/components/operacoes/MargensFrota';
import { ESTADOS_PARADOS, TempoParados } from '@/components/operacoes/TempoParados';
import { CarList, MetricCard } from '@/components/operacoes/MetricCard';
import { STATUSES } from '@/lib/operacoes/constants';
import { eur } from '@/lib/operacoes/custos';

export default function OpsVisao() {
  const { openNovaViatura } = useOps();
  const { data: carros = [], isLoading, isError } = useCarros();
  const s = getStats(carros);
  const alugados = carros.filter((v) => v.estado === 'Alugado' && v.tipo_gestao !== 'Slot');
  const renda = alugados.reduce((sum, v) => sum + parseEuros(v.valor_aluguer_semanal) * 4.33, 0);
  const parados = carros.filter((v) => (ESTADOS_PARADOS as readonly string[]).includes(v.estado || ''));

  const vianta = carros.filter((v) => v.proprietario === 'VIANTA');
  const investidores = carros.filter(
    (v) => v.proprietario && v.proprietario !== 'VIANTA' && v.tipo_gestao !== 'Slot',
  );
  const slot = carros.filter((v) => v.tipo_gestao === 'Slot');
  const lista = (cs: typeof carros) => ({
    title: '',
    render: (close: () => void) => <CarList items={cs.map((carro) => ({ carro }))} onPick={close} />,
  });

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
            <MetricCard
              icon="🚗"
              color="#6ee7b7"
              value={alugados.length}
              label="Frota Ativa"
              sub="Alugados na rua"
              to="/operacoes/frota"
            />
            <MetricCard
              icon="🏪"
              color="#93c5fd"
              value={s.stock}
              label="Em Stock"
              sub="Para venda / aluguer"
              to="/operacoes/stock"
            />
            <MetricCard
              icon="🔧"
              color="#fbbf24"
              value={parados.length}
              label="Parados"
              sub="Preparação, aluguer, venda e manutenção"
              to="/operacoes/stock"
            />
            <TempoParados carros={carros} />
            <MetricCard
              icon="💰"
              color="#9ca3af"
              value={s.vendidos}
              label="Vendidos"
              sub="Este ano"
              detail={{
                title: `Vendidos (${s.vendidos})`,
                render: (close) => (
                  <CarList
                    items={carros.filter((v) => v.estado === 'Vendido').map((carro) => ({ carro }))}
                    onPick={close}
                  />
                ),
              }}
            />
            <MetricCard
              icon="📈"
              color="#22c55e"
              value={`€${Math.round(renda).toLocaleString()}`}
              label="Receita Aluguer/mês"
              sub={`Estimada (${alugados.length} alugados)`}
              detail={{
                title: `Receita de aluguer/mês · ${eur(Math.round(renda))}`,
                render: (close) => (
                  <CarList
                    items={[...alugados]
                      .sort(
                        (a, b) => parseEuros(b.valor_aluguer_semanal) - parseEuros(a.valor_aluguer_semanal),
                      )
                      .map((carro) => ({
                        carro,
                        extra: `${eur(Math.round(parseEuros(carro.valor_aluguer_semanal) * 4.33))}/mês`,
                      }))}
                    onPick={close}
                  />
                ),
              }}
            />
            <MetricCard
              icon="🚘"
              color="#60a5fa"
              value={s.total}
              label="Total Frota"
              sub="Todas as viaturas"
              detail={{
                title: `Total da frota (${s.total})`,
                render: (close) => (
                  <div className="flex flex-col gap-4">
                    {STATUSES.map((estado) => {
                      const cs = carros.filter((v) => v.estado === estado);
                      if (!cs.length) return null;
                      return (
                        <div key={estado}>
                          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                            {estado} ({cs.length})
                          </div>
                          <CarList items={cs.map((carro) => ({ carro }))} onPick={close} />
                        </div>
                      );
                    })}
                  </div>
                ),
              }}
            />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            {(
              [
                ['Proprietário VIANTA', vianta],
                ['Investidores', investidores],
                ['Slot', slot],
              ] as const
            ).map(([label, cs]) => (
              <MetricCard
                key={label}
                compact
                label={label}
                value={cs.length}
                detail={{ ...lista(cs), title: `${label} (${cs.length})` }}
              />
            ))}
          </div>
          <MargensFrota carros={carros} />
        </div>
      )}
    </>
  );
}
