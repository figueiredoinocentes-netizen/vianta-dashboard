import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getDaysInMonth, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { useSheetData } from '@/hooks/useSheetData';
import { useRawLeads } from '@/hooks/useRawLeads';
import { useLeadMovements } from '@/hooks/useLeadMovements';
import type { RawMovement } from '@/hooks/useLeadMovements';
import { useConfigStages, getSQLStages } from '@/hooks/useConfigStages';
import { useMonthlyObjectives } from '@/hooks/useMonthlyObjectives';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { SheetData, MonthlyObjective, RawLead, Driver, PipelineStageConfig } from '@/types/dashboard';

// --- Helpers ---

const now = new Date();
const diaActual = now.getDate();
const diasNoMes = getDaysInMonth(now);
const diasRestantes = Math.max(diasNoMes - diaActual, 0);
const pctMes = (diaActual / diasNoMes) * 100;
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const currentMonthDate = `${currentMonthKey}-01`;

// Semana passada = último Seg-Dom já concluído, independentemente do dia da semana actual.
const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
const prevWeekStart = startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
const prevWeekEnd = endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });

function safeDivide(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

function fmt(v: number | null, prefix = '', suffix = ''): string {
  if (v === null || isNaN(v)) return '—';
  return `${prefix}${Math.round(v).toLocaleString()}${suffix}`;
}

function fmtPct(v: number | null): string {
  if (v === null || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

export type MetricColor = 'green' | 'yellow' | 'red';

export function getPaceColor(progressPct: number): MetricColor {
  const ratio = progressPct / pctMes;
  if (ratio >= 1) return 'green';
  if (ratio >= 0.6) return 'yellow';
  return 'red';
}

function progressBarClass(color: MetricColor): string {
  switch (color) {
    case 'green': return '[&>div]:bg-emerald-500';
    case 'yellow': return '[&>div]:bg-yellow-400';
    case 'red': return '[&>div]:bg-rose-500';
  }
}

// Alavanca sugerida por métrica — o que ajustar quando esta métrica está atrasada.
const LEVER_BY_LABEL: Record<string, string> = {
  'Leads': 'rever investimento/canais de aquisição',
  'SQLs': 'rever qualificação e velocidade de resposta a leads',
  'Pré Aprovações': 'rever recolha de documentos e follow-up de crédito',
  'Novos fechos': 'rever follow-up comercial e negociação',
  'Revenue': 'rever ticket médio e mix de ofertas fechadas',
};

interface MetricDef {
  label: string;
  actual: number;
  target: number | null;
  format: (v: number) => string;
  invertPace?: boolean; // for budget/churn — lower is better
  remaining?: number;
  dailyNeeded?: number;
  weeklyNeeded?: number;
  expectedToDate?: number;
}

function withRunRate(m: MetricDef): MetricDef {
  if (m.target === null || m.target <= 0) return m;
  const remaining = Math.max(m.target - m.actual, 0);
  const dailyNeeded = diasRestantes > 0 ? remaining / diasRestantes : remaining;
  // Objectivo proporcional aos dias já decorridos do mês — é isto (não o total do mês)
  // que determina se estamos "em risco" a esta altura do mês.
  const expectedToDate = m.target * (diaActual / diasNoMes);
  return { ...m, remaining, dailyNeeded, weeklyNeeded: dailyNeeded * 7, expectedToDate };
}

function computeMetrics(
  oferta: 'aluguer' | 'compra',
  sheetMonth: SheetData | undefined,
  sheetAll: SheetData | undefined,
  sheet90d: SheetData | undefined,
  objective: MonthlyObjective | null,
  leadsCount: number,
  sqlsCount: number,
  preAprovacaoCount: number,
): MetricDef[] {
  const revenue = sheetMonth?.monthlyRevenue.find(r => r.month === currentMonthKey)?.revenue ?? 0;
  const fechos = sheetMonth?.kpis.totalDrivers ?? 0;
  const budget = sheetMonth?.kpis.investimentoTotal ?? 0;

  const base: MetricDef[] = [
    { label: 'Revenue', actual: revenue, target: objective?.revenueAlvo ?? null, format: v => `€${Math.round(v).toLocaleString()}` },
    { label: 'Novos fechos', actual: fechos, target: objective?.fechosAlvo ?? null, format: v => String(Math.round(v)) },
    { label: 'SQLs', actual: sqlsCount, target: objective?.sqlsAlvo ?? null, format: v => String(Math.round(v)) },
    { label: 'Leads', actual: leadsCount, target: objective?.leadsAlvo ?? null, format: v => String(Math.round(v)) },
    { label: 'Budget gasto', actual: budget, target: objective?.budgetAlvo ?? null, format: v => `€${Math.round(v).toLocaleString()}`, invertPace: true },
  ];

  if (oferta === 'compra') {
    base.push({
      label: 'Pré Aprovações',
      actual: preAprovacaoCount,
      target: objective?.preAprovacaoAlvo ?? null,
      format: v => String(Math.round(v)),
    });
  }

  if (oferta === 'aluguer') {
    const churnRate90d = sheet90d?.churnBreakdown.taxaChurn ?? 0;
    const activeBase = sheetAll?.kpis.totalDrivers ?? 0;
    const churnsMonth = sheetMonth?.churnBreakdown.churnedDrivers ?? 0;
    const expectedChurns = Math.round(activeBase * (churnRate90d / 100));
    base.push({
      label: 'Churn (saídas)',
      actual: churnsMonth,
      target: expectedChurns > 0 ? expectedChurns : null,
      format: v => String(Math.round(v)),
      invertPace: true,
    });
  } else {
    const cicloMonth = sheetMonth?.kpis.cicloVendaMedio ?? 0;
    const ciclo90d = sheet90d?.kpis.cicloVendaMedio ?? 0;
    base.push({
      label: 'Ciclo médio',
      actual: cicloMonth,
      target: ciclo90d > 0 ? ciclo90d : null,
      format: v => `${Math.round(v)} dias`,
      invertPace: true,
    });
  }

  return base.map(withRunRate);
}

interface Alert {
  severity: MetricColor;
  text: string;
}

function generateAlerts(metricsAluguer: MetricDef[], metricsCompra: MetricDef[]): Alert[] {
  const alerts: Alert[] = [];

  const process = (metrics: MetricDef[], oferta: string) => {
    for (const m of metrics) {
      if (m.target === null || m.target === 0) continue;
      if (m.invertPace) continue; // skip inverted metrics for alerts

      const progressPct = (m.actual / m.target) * 100;
      const ratio = progressPct / pctMes;
      const projection = diaActual > 0 ? m.actual * (diasNoMes / diaActual) : 0;
      const lever = LEVER_BY_LABEL[m.label];

      if (ratio < 0.6) {
        alerts.push({
          severity: 'red',
          text: `${oferta} — ${m.label} a ${Math.round(progressPct)}% do objectivo (${Math.round(ratio * 100)}% do ritmo). Projecção: ${m.format(projection)}.`
            + (lever ? ` Ajuste sugerido: ${lever}.` : ''),
        });
      } else if (ratio < 0.9) {
        alerts.push({
          severity: 'yellow',
          text: `${oferta} — ${m.label} a ${Math.round(progressPct)}% do objectivo (${Math.round(ratio * 100)}% do ritmo). Projecção: ${m.format(projection)}.`
            + (lever ? ` Ajuste sugerido: ${lever}.` : ''),
        });
      } else if (ratio > 1.1) {
        alerts.push({
          severity: 'green',
          text: `${oferta} — ${m.label} acima do ritmo (${Math.round(ratio * 100)}%). Projecção: ${m.format(projection)}.`,
        });
      }
    }
  };

  process(metricsAluguer, 'Aluguer');
  process(metricsCompra, 'Compra');

  // Sort by severity: red > yellow > green
  const order: Record<MetricColor, number> = { red: 0, yellow: 1, green: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts.slice(0, 5);
}

function getStatusBadge(metrics: MetricDef[], hasObjective: boolean): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string } {
  if (!hasObjective) return { label: 'Sem objectivo', variant: 'outline', className: 'text-muted-foreground border-muted' };

  let belowPace = 0;
  for (const m of metrics) {
    if (m.target === null || m.target === 0 || m.invertPace) continue;
    const ratio = ((m.actual / m.target) * 100) / pctMes;
    if (ratio < 1) belowPace++;
  }

  if (belowPace === 0) return { label: 'No ritmo', variant: 'default', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  if (belowPace <= 2) return { label: 'Atenção', variant: 'secondary', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  return { label: 'Em risco', variant: 'destructive', className: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
}

// --- Weekly metrics (para o ponto de partida da análise de segunda-feira) ---

interface WeeklyMetrics {
  leads: number;
  sqls: number;
  fechos: number;
  revenue: number;
  preAprovacao: number;
}

function offerMatches(offerField: string | undefined, oferta: 'aluguer' | 'compra'): boolean {
  const v = offerField?.toLowerCase() ?? '';
  return oferta === 'aluguer' ? v.includes('aluguer') : (v.includes('compra') || v.includes('venda'));
}

function computeWeeklyMetrics(
  oferta: 'aluguer' | 'compra',
  leads: RawLead[],
  movements: RawMovement[],
  driversAll: Driver[],
  configs: PipelineStageConfig[],
  from: Date,
  to: Date,
): WeeklyMetrics {
  const inRange = (d: Date) => d >= from && d <= to;

  const weekLeads = leads.filter(l => {
    if (!l.dataRegisto) return false;
    if (!offerMatches(l.oferta, oferta)) return false;
    return inRange(new Date(l.dataRegisto));
  }).length;

  const pipelines = [...new Set(
    configs
      .filter(c => offerMatches(c.pipeline_name, oferta))
      .map(c => c.pipeline_name)
  )];
  const sqlStages = pipelines.flatMap(p => getSQLStages(p, configs));

  const sqlSet = new Set<string>();
  const fechoSet = new Set<string>();
  const preAprovacaoSet = new Set<string>();
  movements.forEach(m => {
    if (!m.date) return;
    const d = new Date(m.date);
    if (!inRange(d)) return;
    if (!pipelines.some(p => m.pipeline.toLowerCase() === p.toLowerCase())) return;
    if (sqlStages.includes(m.stage)) sqlSet.add(m.nome);
    if (m.stage === 'Fechado') fechoSet.add(m.nome);
    if (m.stage.trim() === 'Pré Aprovação Submetida') preAprovacaoSet.add(m.nome);
  });

  const revenue = driversAll
    .filter(d => d.dataFecho && d.ticket !== null && d.ticket > 0 && d.tipoOferta === oferta)
    .filter(d => inRange(new Date(d.dataFecho!)))
    .reduce((sum, d) => sum + (d.tipoOferta === 'aluguer' ? d.ticket! * 4 : d.ticket!), 0);

  return { leads: weekLeads, sqls: sqlSet.size, fechos: fechoSet.size, revenue, preAprovacao: preAprovacaoSet.size };
}

function DeltaIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (current > previous) return <ArrowUp className="h-3 w-3 text-emerald-400" />;
  if (current < previous) return <ArrowDown className="h-3 w-3 text-rose-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

// Objectivo semanal = fatia proporcional do objectivo mensal (target ÷ dias do mês × 7).
// Uma semana completa (Seg-Dom) é sempre comparável directamente a este valor, sem mais proporção.
export function weeklyTarget(monthlyTarget: number | null | undefined): number | null {
  if (!monthlyTarget || monthlyTarget <= 0) return null;
  return (monthlyTarget / diasNoMes) * 7;
}

export function weeklyPaceColor(actual: number, target: number | null): MetricColor | null {
  if (target === null || target <= 0) return null;
  const ratio = actual / target;
  if (ratio >= 1) return 'green';
  if (ratio >= 0.6) return 'yellow';
  return 'red';
}

function WeeklyCard({ oferta, thisWeek, prevWeek, objective }: {
  oferta: string;
  thisWeek: WeeklyMetrics;
  prevWeek: WeeklyMetrics;
  objective: MonthlyObjective | null;
}) {
  const rows: { label: string; cur: number; prev: number; target: number | null; format: (v: number) => string }[] = [
    { label: 'Leads', cur: thisWeek.leads, prev: prevWeek.leads, target: weeklyTarget(objective?.leadsAlvo), format: v => String(Math.round(v)) },
    { label: 'SQLs', cur: thisWeek.sqls, prev: prevWeek.sqls, target: weeklyTarget(objective?.sqlsAlvo), format: v => String(Math.round(v)) },
    { label: 'Fechos', cur: thisWeek.fechos, prev: prevWeek.fechos, target: weeklyTarget(objective?.fechosAlvo), format: v => String(Math.round(v)) },
    { label: 'Revenue', cur: thisWeek.revenue, prev: prevWeek.revenue, target: weeklyTarget(objective?.revenueAlvo), format: v => `€${Math.round(v).toLocaleString()}` },
  ];
  if (oferta === 'Compra') {
    rows.push({
      label: 'Pré Aprovações',
      cur: thisWeek.preAprovacao,
      prev: prevWeek.preAprovacao,
      target: weeklyTarget(objective?.preAprovacaoAlvo),
      format: v => String(Math.round(v)),
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{oferta}</p>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(r => {
          const color = weeklyPaceColor(r.cur, r.target);
          return (
            <div key={r.label} className={`rounded-lg border px-3 py-2 ${color === 'red' ? 'border-rose-500/40' : color === 'yellow' ? 'border-yellow-400/40' : color === 'green' ? 'border-emerald-500/40' : 'border-border/50'}`}>
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold text-foreground">{r.format(r.cur)}</span>
                <DeltaIndicator current={r.cur} previous={r.prev} />
              </div>
              <p className="text-xs text-muted-foreground">vs semana ant. {r.format(r.prev)}</p>
              {r.target !== null ? (
                <p className={`text-xs mt-0.5 ${color === 'red' ? 'text-rose-400' : color === 'yellow' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  Objectivo semanal: {r.format(r.target)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/60 mt-0.5">Sem objectivo</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Offer Card ---

function OfferCard({ oferta, metrics, objective, footer }: {
  oferta: string;
  metrics: MetricDef[];
  objective: MonthlyObjective | null;
  footer?: React.ReactNode;
}) {
  const hasObjective = objective !== null;
  const badge = getStatusBadge(metrics, hasObjective);

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{oferta}</CardTitle>
          <Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasObjective ? (
          <div className="text-center py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {metrics.map(m => (
                <div key={m.label} className="text-left">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-medium text-foreground">{m.format(m.actual)}</p>
                  <p className="text-xs text-muted-foreground/60">Sem objectivo</p>
                </div>
              ))}
            </div>
            <Link to="/planeamento">
              <Button variant="outline" size="sm" className="mt-2">Definir objectivo</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {metrics.map(m => {
              const progressPct = m.target && m.target > 0 ? (m.actual / m.target) * 100 : 0;
              const color = m.target && m.target > 0
                ? (m.invertPace ? (progressPct <= pctMes * 100 / 100 ? 'green' : progressPct <= pctMes * 100 / 60 ? 'yellow' : 'red') : getPaceColor(progressPct))
                : 'green';
              const borderClass = m.target && m.target > 0
                ? (color === 'red' ? 'border-rose-500/40' : color === 'yellow' ? 'border-yellow-400/40' : 'border-emerald-500/40')
                : 'border-border/50';
              const textClass = color === 'red' ? 'text-rose-400' : color === 'yellow' ? 'text-yellow-400' : 'text-emerald-400';

              return (
                <div key={m.label} className={`rounded-lg border px-3 py-2 space-y-1 ${borderClass}`}>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-foreground">{m.format(m.actual)}</span>
                    {m.target !== null && (
                      <span className="text-xs text-muted-foreground">/ {m.format(m.target)}</span>
                    )}
                  </div>
                  {m.target !== null && m.target > 0 && (
                    <>
                      <Progress value={Math.min(progressPct, 100)} className={`h-2 ${progressBarClass(color)}`} />
                      <p className={`text-xs font-medium ${textClass}`}>
                        {Math.round(progressPct)}% do objectivo · esperado até hoje: {m.format(m.expectedToDate ?? 0)}
                      </p>
                      {!m.invertPace && m.remaining !== undefined && (
                        <p className="text-xs text-muted-foreground/70">
                          {m.remaining > 0
                            ? `Faltam ${m.format(m.remaining)} · ~${m.format(m.weeklyNeeded ?? 0)}/semana até final do mês`
                            : 'Objectivo atingido'}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {footer && <div className="pt-2 border-t border-border/30 text-xs text-muted-foreground">{footer}</div>}
      </CardContent>
    </Card>
  );
}

// --- Main Component ---

export default function MonthlyProgressTab() {
  const { getObjective } = useMonthlyObjectives();
  const { data: leadsAll = [] } = useRawLeads();
  const { data: movementsData } = useLeadMovements();
  const { data: configs = [] } = useConfigStages();

  const { data: sheetAluguer } = useSheetData({ period: 'month', offerTypes: ['aluguer'], source: 'todos', selectedMonth: currentMonthKey });
  const { data: sheetCompra } = useSheetData({ period: 'month', offerTypes: ['compra'], source: 'todos', selectedMonth: currentMonthKey });
  const { data: sheetAllAluguer } = useSheetData({ period: 'all', offerTypes: ['aluguer'], source: 'todos' });
  const { data: sheetAllCompra } = useSheetData({ period: 'all', offerTypes: ['compra'], source: 'todos' });
  const { data: sheet90d } = useSheetData({ period: '90d', offerTypes: [], source: 'todos' });

  const objAluguer = getObjective('aluguer', currentMonthDate);
  const objCompra = getObjective('compra', currentMonthDate);

  // Count leads for current month by oferta
  const { leadsAluguer, leadsCompra, sqlsAluguer, sqlsCompra, preAprovacaoCompra } = useMemo(() => {
    const movements = movementsData?.movements ?? [];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Leads from rawLeads
    const monthLeads = leadsAll.filter(l => {
      if (!l.dataRegisto) return false;
      const d = new Date(l.dataRegisto);
      return d >= monthStart && d <= monthEnd;
    });

    const la = monthLeads.filter(l => l.oferta?.toLowerCase().includes('aluguer')).length;
    const lc = monthLeads.filter(l => l.oferta?.toLowerCase().includes('compra') || l.oferta?.toLowerCase().includes('venda')).length;

    // SQLs from movements
    const monthMovements = movements.filter(m => {
      if (!m.date) return false;
      const d = new Date(m.date);
      return d >= monthStart && d <= monthEnd;
    });

    const pipelinesAluguer = configs.filter(c => c.pipeline_name.toLowerCase().includes('aluguer')).map(c => c.pipeline_name);
    const pipelinesCompra = configs.filter(c => c.pipeline_name.toLowerCase().includes('compra') || c.pipeline_name.toLowerCase().includes('venda')).map(c => c.pipeline_name);
    const uniquePipelinesA = [...new Set(pipelinesAluguer)];
    const uniquePipelinesC = [...new Set(pipelinesCompra)];

    const sqlStagesA = uniquePipelinesA.flatMap(p => getSQLStages(p, configs));
    const sqlStagesC = uniquePipelinesC.flatMap(p => getSQLStages(p, configs));

    const sqlSetA = new Set<string>();
    const sqlSetC = new Set<string>();
    const preAprovacaoSetC = new Set<string>();
    monthMovements.forEach(m => {
      if (sqlStagesA.includes(m.stage) && uniquePipelinesA.some(p => m.pipeline.toLowerCase() === p.toLowerCase())) {
        sqlSetA.add(m.nome);
      }
      if (sqlStagesC.includes(m.stage) && uniquePipelinesC.some(p => m.pipeline.toLowerCase() === p.toLowerCase())) {
        sqlSetC.add(m.nome);
      }
      if (m.stage.trim() === 'Pré Aprovação Submetida' && uniquePipelinesC.some(p => m.pipeline.toLowerCase() === p.toLowerCase())) {
        preAprovacaoSetC.add(m.nome);
      }
    });

    return { leadsAluguer: la, leadsCompra: lc, sqlsAluguer: sqlSetA.size, sqlsCompra: sqlSetC.size, preAprovacaoCompra: preAprovacaoSetC.size };
  }, [leadsAll, movementsData, configs]);

  const metricsAluguer = useMemo(
    () => computeMetrics('aluguer', sheetAluguer, sheetAllAluguer, sheet90d, objAluguer, leadsAluguer, sqlsAluguer, 0),
    [sheetAluguer, sheetAllAluguer, sheet90d, objAluguer, leadsAluguer, sqlsAluguer]
  );

  const metricsCompra = useMemo(
    () => computeMetrics('compra', sheetCompra, undefined, sheet90d, objCompra, leadsCompra, sqlsCompra, preAprovacaoCompra),
    [sheetCompra, sheet90d, objCompra, leadsCompra, sqlsCompra, preAprovacaoCompra]
  );

  const alerts = useMemo(() => generateAlerts(metricsAluguer, metricsCompra), [metricsAluguer, metricsCompra]);

  // Semana passada vs semana anterior — ponto de partida da análise de segunda-feira.
  const weeklyAluguer = useMemo(() => {
    const movements = movementsData?.movements ?? [];
    const driversAll = sheetAllAluguer?.drivers ?? [];
    return {
      thisWeek: computeWeeklyMetrics('aluguer', leadsAll, movements, driversAll, configs, lastWeekStart, lastWeekEnd),
      prevWeek: computeWeeklyMetrics('aluguer', leadsAll, movements, driversAll, configs, prevWeekStart, prevWeekEnd),
    };
  }, [leadsAll, movementsData, sheetAllAluguer, configs]);

  const weeklyCompra = useMemo(() => {
    const movements = movementsData?.movements ?? [];
    const driversAll = sheetAllCompra?.drivers ?? [];
    return {
      thisWeek: computeWeeklyMetrics('compra', leadsAll, movements, driversAll, configs, lastWeekStart, lastWeekEnd),
      prevWeek: computeWeeklyMetrics('compra', leadsAll, movements, driversAll, configs, prevWeekStart, prevWeekEnd),
    };
  }, [leadsAll, movementsData, sheetAllCompra, configs]);

  const isLoading = !sheetAluguer && !sheetCompra;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const activeBase = sheetAllAluguer?.kpis.totalDrivers ?? 0;
  const revenueBase = sheetAllAluguer?.monthlyRevenue.reduce((sum, r) => sum + r.revenue, 0) ?? 0;
  const avgMonthlyRevenue = sheetAllAluguer?.monthlyRevenue.length ? Math.round(revenueBase / sheetAllAluguer.monthlyRevenue.length) : 0;

  const dotColor = (c: MetricColor) => c === 'green' ? 'bg-emerald-500' : c === 'yellow' ? 'bg-yellow-400' : 'bg-rose-500';

  return (
    <div className="space-y-6">
      {/* Month Progress Indicator */}
      <Card className="glass-card border-border/50">
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              Dia {diaActual} de {diasNoMes} — {Math.round(pctMes)}% do mês decorrido
            </p>
            <p className="text-xs text-muted-foreground">
              {now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Progress value={pctMes} className="h-2.5 [&>div]:bg-primary" />
          <p className="text-xs text-muted-foreground">
            Para estar no ritmo, cada métrica deve estar a ≥{Math.round(pctMes)}%
          </p>
        </CardContent>
      </Card>

      {/* Two Offer Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OfferCard
          oferta="Aluguer"
          metrics={metricsAluguer}
          objective={objAluguer}
          footer={
            <span>Base activa: {activeBase} drivers · Revenue recorrente (média mensal): €{avgMonthlyRevenue.toLocaleString()}</span>
          }
        />
        <OfferCard
          oferta="Compra"
          metrics={metricsCompra}
          objective={objCompra}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alertas automáticos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotColor(a.severity)}`} />
                <p className="text-sm text-foreground/90">{a.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Semana passada — ponto de partida da análise de segunda-feira */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Semana passada ({lastWeekStart.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} — {lastWeekEnd.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeeklyCard oferta="Aluguer" thisWeek={weeklyAluguer.thisWeek} prevWeek={weeklyAluguer.prevWeek} objective={objAluguer} />
          <WeeklyCard oferta="Compra" thisWeek={weeklyCompra.thisWeek} prevWeek={weeklyCompra.prevWeek} objective={objCompra} />
        </CardContent>
      </Card>
    </div>
  );
}
