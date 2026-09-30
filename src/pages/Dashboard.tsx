import { useState, useMemo, useCallback } from 'react';
import MonthlyProgressTab from '@/components/dashboard/MonthlyProgressTab';
import CACBreakdownDialog from '@/components/dashboard/CACBreakdownDialog';
import ChurnBreakdownDialog from '@/components/dashboard/ChurnBreakdownDialog';
import LTVBreakdownDialog from '@/components/dashboard/LTVBreakdownDialog';
import InvestmentBreakdownDialog from '@/components/dashboard/InvestmentBreakdownDialog';
import { motion } from 'framer-motion';
import { DollarSign, Users, TrendingDown, TrendingUp, Clock, Percent, BarChart3 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/dashboard/KPICard';
import GlobalFilters from '@/components/dashboard/GlobalFilters';
import AcquisitionSourceChart from '@/components/dashboard/AcquisitionSourceChart';
import ClosingsEvolutionChart from '@/components/dashboard/ClosingsEvolutionChart';
import RevenueEvolutionChart from '@/components/dashboard/RevenueEvolutionChart';
import MonthlyClosingsDetail from '@/components/dashboard/MonthlyClosingsDetail';
import { useSheetData } from '@/hooks/useSheetData';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useMonthlyObjectives } from '@/hooks/useMonthlyObjectives';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { FilterState } from '@/types/dashboard';

function getCurrentQuarterMonths(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3);
  return [0, 1, 2].map(i => {
    const m = q * 3 + i + 1;
    return `${year}-${String(m).padStart(2, '0')}-01`;
  });
}

function getYearMonths(): string[] {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`);
}

const Dashboard = () => {
  const DASHBOARD_DEFAULTS = useMemo(() => ({ period: 'all', offerTypes: '', source: 'todos', selectedMonth: undefined as string | undefined, customDateFrom: undefined as string | undefined, customDateTo: undefined as string | undefined }), []);
  const [persistedFilters, setPersistedFilters] = usePersistedFilters('dashboard-filters', DASHBOARD_DEFAULTS);

  const filters: FilterState = useMemo(() => ({
    period: persistedFilters.period as FilterState['period'],
    offerTypes: persistedFilters.offerTypes ? persistedFilters.offerTypes.split(',').filter(Boolean) as any : [],
    source: persistedFilters.source || 'todos',
    selectedMonth: persistedFilters.selectedMonth,
    customDateFrom: persistedFilters.customDateFrom,
    customDateTo: persistedFilters.customDateTo,
  }), [persistedFilters]);

  const setFilters = useCallback((f: FilterState) => {
    setPersistedFilters({
      period: f.period,
      offerTypes: f.offerTypes.length > 0 ? f.offerTypes.join(',') : '',
      source: f.source,
      selectedMonth: f.selectedMonth,
      customDateFrom: f.customDateFrom,
      customDateTo: f.customDateTo,
    });
  }, [setPersistedFilters]);
  const [showCACBreakdown, setShowCACBreakdown] = useState(false);
  const [showChurnBreakdown, setShowChurnBreakdown] = useState(false);
  const [showLTVBreakdown, setShowLTVBreakdown] = useState(false);
  const [showInvestmentBreakdown, setShowInvestmentBreakdown] = useState(false);

  const { data, isLoading, isError, error } = useSheetData(filters);
  const { getObjectivesForMonth } = useMonthlyObjectives();

  const quarterMonths = useMemo(() => getCurrentQuarterMonths(), []);

  const quarterlyObjectives = useMemo(() => {
    let revenue = 0, fechos = 0, budget = 0;
    let hasAny = false;
    for (const m of quarterMonths) {
      const objs = getObjectivesForMonth(m);
      for (const o of objs) {
        if (o.oferta === 'aluguer' || o.oferta === 'compra') {
          revenue += o.revenueAlvo;
          fechos += o.fechosAlvo;
          budget += o.budgetAlvo;
          hasAny = true;
        }
      }
    }
    return hasAny ? { revenue, fechos, budget } : null;
  }, [quarterMonths, getObjectivesForMonth]);

  const revenueObjectives = useMemo(() => {
    const yearMonths = getYearMonths();
    const result: { month: string; target: number }[] = [];
    let hasAny = false;
    for (const m of yearMonths) {
      const objs = getObjectivesForMonth(m);
      let total = 0;
      for (const o of objs) {
        if (o.oferta === 'aluguer' || o.oferta === 'compra') {
          total += o.revenueAlvo;
          hasAny = true;
        }
      }
      const monthKey = m.slice(0, 7); // "2026-05"
      result.push({ month: monthKey, target: total });
    }
    return hasAny ? result : [];
  }, [getObjectivesForMonth]);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            Dashboard <span className="text-gradient-primary">Marketing & Comercial</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do desempenho — Vianta
          </p>
        </motion.div>

        <GlobalFilters
          filters={filters}
          onFiltersChange={setFilters}
          fontes={data?.fontes || []}
        />
      </div>

      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="progresso-mensal">Progresso Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[120px] rounded-xl" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[340px] rounded-xl" />
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-destructive font-medium text-lg">Erro ao carregar dados</p>
              <p className="text-sm text-muted-foreground mt-2">{error?.message}</p>
              <p className="text-xs text-muted-foreground mt-4">
                Verifica se a Google Sheet está acessível e a API key está correta.
              </p>
            </div>
          )}

          {/* Data loaded */}
          {data && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-8">
                <KPICard
                  title="Vendas"
                  value={String(data.kpis.totalDrivers)}
                  icon={<Users className="h-4 w-4" />}
                  delay={0}
                  tooltip="Número total de drivers que fecharam contrato no período selecionado."
                  numericValue={data.kpis.totalDrivers}
                  objective={quarterlyObjectives?.fechos}
                  objectiveLabel={quarterlyObjectives ? String(quarterlyObjectives.fechos) : undefined}
                />
                <KPICard
                  title="Investimento"
                  value={`€${data.kpis.investimentoTotal.toLocaleString()}`}
                  icon={<DollarSign className="h-4 w-4" />}
                  delay={0.05}
                  tooltip="Soma total do investimento em tráfego pago, equipa comercial e referências. Clica para ver o detalhe."
                  onClick={() => setShowInvestmentBreakdown(true)}
                  numericValue={data.kpis.investimentoTotal}
                  objective={quarterlyObjectives?.budget}
                  objectiveLabel={quarterlyObjectives ? `€${Math.round(quarterlyObjectives.budget).toLocaleString()}` : undefined}
                />
                <KPICard
                  title="CAC Médio"
                  value={`€${Math.round(data.kpis.cacMedio)}`}
                  icon={<TrendingDown className="h-4 w-4" />}
                  delay={0.1}
                  tooltip="Custo de Aquisição por Cliente. Clica para ver o detalhe do cálculo."
                  onClick={() => setShowCACBreakdown(true)}
                />
                <KPICard
                  title="Ciclo Venda"
                  value={`${Math.round(data.kpis.cicloVendaMedio)} dias`}
                  icon={<Clock className="h-4 w-4" />}
                  delay={0.15}
                  tooltip="Média de dias entre a data de entrada do lead e a data de fecho do contrato."
                />
                <KPICard
                  title="Churn"
                  value={`${data.kpis.taxaChurn.toFixed(1)}%`}
                  icon={<Percent className="h-4 w-4" />}
                  delay={0.2}
                  tooltip="Percentagem de drivers que saíram (cancelaram) em relação ao total de drivers fechados. Clica para ver o detalhe."
                  onClick={() => setShowChurnBreakdown(true)}
                />
                <KPICard
                  title="Ticket Médio"
                  value={`€${Math.round(data.kpis.ticketMedio).toLocaleString()}`}
                  icon={<BarChart3 className="h-4 w-4" />}
                  delay={0.25}
                  tooltip="Valor médio dos contratos dos drivers fechados no período selecionado."
                />
                <KPICard
                  title="LTV Médio"
                  value={`€${Math.round(data.kpis.ltv).toLocaleString()}`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  delay={0.3}
                  tooltip="Lifetime Value médio — receita real gerada por driver, calculada como Ticket mensal × Meses ativos. Clica para ver o detalhe."
                  onClick={() => setShowLTVBreakdown(true)}
                />
              </div>

              {/* Revenue Chart - Full Width */}
              <div className="mb-6">
                <RevenueEvolutionChart data={data.monthlyRevenue} objectives={revenueObjectives} />
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ClosingsEvolutionChart data={data.monthlyClosings} />
                <AcquisitionSourceChart data={data.sourceDistribution} />
              </div>

              {/* Monthly Detail */}
              <MonthlyClosingsDetail data={data.monthlyClosingDetails} />

              {/* Dialogs */}
              <CACBreakdownDialog open={showCACBreakdown} onOpenChange={setShowCACBreakdown} breakdown={data.cacBreakdown} />
              <ChurnBreakdownDialog open={showChurnBreakdown} onOpenChange={setShowChurnBreakdown} breakdown={data.churnBreakdown} />
              <LTVBreakdownDialog open={showLTVBreakdown} onOpenChange={setShowLTVBreakdown} breakdown={data.ltvBreakdown} />
              <InvestmentBreakdownDialog open={showInvestmentBreakdown} onOpenChange={setShowInvestmentBreakdown} breakdown={data.investmentBreakdown} />
            </>
          )}
        </TabsContent>

        <TabsContent value="progresso-mensal">
          <MonthlyProgressTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Dashboard;
