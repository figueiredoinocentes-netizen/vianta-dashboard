import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LeadsListDialog, { rawLeadsToDialog, type LeadsListDialogLead } from '@/components/marketing/LeadsListDialog';
import ConversaoBreakdownDialog from '@/components/dashboard/ConversaoBreakdownDialog';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/dashboard/KPICard';
import { useRawLeads } from '@/hooks/useRawLeads';
import { useLeadMovements } from '@/hooks/useLeadMovements';
import { useConfigStages, getSQLStagesExpanded, expandStagesWithAliases } from '@/hooks/useConfigStages';
import { useSheetData } from '@/hooks/useSheetData';
import { useGHLData } from '@/hooks/useGHLData';
import { useMetaCreativeNames, isMetaAdId } from '@/hooks/useMetaCreativeNames';
import { useMetaInsights } from '@/hooks/useMetaInsights';
import { useFunnelVisualConfig } from '@/hooks/useFunnelVisualConfig';
import { useMonthlyObjectives } from '@/hooks/useMonthlyObjectives';
import { getPaceColor, weeklyPaceColor, weeklyTarget, type MetricColor } from '@/components/dashboard/MonthlyProgressTab';
import type { RawLead, MarketingPeriod, FilterState, OfferType, SourceMapping } from '@/types/dashboard';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useSourceMapping, getCanal, getTipo } from '@/hooks/useSourceMapping';
import type { RawMovement } from '@/hooks/useLeadMovements';
import { Users, TrendingUp, Target, Percent, DollarSign, Layers, CalendarIcon, X, ArrowRight, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line, ReferenceLine } from 'recharts';
import { startOfWeek, endOfWeek, subWeeks, getDaysInMonth, format, parseISO, subDays, startOfMonth, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AdSetQualityTable } from '@/components/marketing/AdSetQualityTable';
import { computeAdSetQualityMetrics } from '@/lib/adSetQuality';

const PERIOD_OPTIONS: { value: MarketingPeriod; label: string }[] = [
  { value: 'week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana passada' },
  { value: 'month', label: 'Este mês' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo o período' },
  { value: 'custom', label: 'Personalizado' },
];

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function getDateRange(period: MarketingPeriod, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date();
  const to = endOfDay(now);
  switch (period) {
    case 'week': return { from: startOfWeek(now, { weekStartsOn: 0 }), to };
    case 'last_week': {
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const from = subDays(thisWeekStart, 7);
      const toDate = endOfDay(subDays(thisWeekStart, 1));
      return { from, to: toDate };
    }
    case 'month': return { from: startOfMonth(now), to };
    case '30d': return { from: startOfDay(subDays(now, 30)), to };
    case '90d': return { from: startOfDay(subDays(now, 90)), to };
    case 'all': return { from: new Date(2000, 0, 1), to };
    case 'custom': {
      const from = customFrom ? startOfDay(parseISO(customFrom)) : startOfDay(subDays(now, 30));
      const toDate = customTo ? endOfDay(parseISO(customTo)) : to;
      return { from, to: toDate };
    }
  }
}

function getPreviousRange(period: MarketingPeriod, current: { from: Date; to: Date }): { from: Date; to: Date } {
  const diff = current.to.getTime() - current.from.getTime();
  return { from: new Date(current.from.getTime() - diff), to: new Date(current.from.getTime() - 1) };
}

function filterLeads(leads: RawLead[], period: MarketingPeriod, oferta: string, customFrom?: string, customTo?: string): RawLead[] {
  const range = getDateRange(period, customFrom, customTo);
  return leads.filter((l) => {
    if (oferta !== 'all' && l.oferta !== oferta) return false;
    if (!l.dataRegisto) return period === 'all';
    const d = parseISO(l.dataRegisto);
    return d >= range.from && d <= range.to;
  });
}

function countByField(leads: RawLead[], field: keyof RawLead): { label: string; count: number }[] {
  const map = new Map<string, number>();
  leads.forEach((l) => {
    const val = (l[field] as string) || 'Sem atribuição';
    map.set(val, (map.get(val) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// Criativo só existe para leads de Paid Media. Para fontes não pagas (Orgânico/Cliente/DM/etc.)
// sem criativo usamos "N/A" em vez de "Sem atribuição", que fica reservado a gaps reais de
// tracking em leads pagos (ex: um lead de Meta Ads sem ad_id capturado).
// `resolveCreativeName` traduz IDs numéricos do Meta (ad.id, estáveis) para o nome atual do
// anúncio; leads antigas com nomes de texto (pré-migração dos UTMs) passam tal como estão.
function getCriativoLabel(
  lead: RawLead,
  mappings: SourceMapping[],
  resolveCreativeName: (value: string) => string,
): string {
  if (lead.criativo) return resolveCreativeName(lead.criativo);
  const tipo = getTipo(lead.fonte, mappings);
  return tipo === 'Paid Media' ? 'Sem atribuição' : 'N/A';
}


function variation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Convert marketing period to FilterState for useSheetData
function toSheetFilterState(period: MarketingPeriod, oferta: string, customFrom?: string, customTo?: string): FilterState {
  const offerTypes: OfferType[] = oferta === 'all'
    ? []
    : [oferta.toLowerCase() as OfferType];

  const now = new Date();

  switch (period) {
    case 'week': {
      const from = startOfWeek(now, { weekStartsOn: 0 });
      return {
        period: 'custom',
        offerTypes,
        source: 'todos',
        customDateFrom: format(from, 'yyyy-MM-dd'),
        customDateTo: format(now, 'yyyy-MM-dd'),
      };
    }
    case 'last_week': {
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const from = subDays(thisWeekStart, 7);
      const toDate = subDays(thisWeekStart, 1);
      return {
        period: 'custom',
        offerTypes,
        source: 'todos',
        customDateFrom: format(from, 'yyyy-MM-dd'),
        customDateTo: format(toDate, 'yyyy-MM-dd'),
      };
    }
    case 'month': {
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return { period: 'month', offerTypes, source: 'todos', selectedMonth: monthKey };
    }
    case '30d':
      return { period: '30d', offerTypes, source: 'todos' };
    case '90d':
      return { period: '90d', offerTypes, source: 'todos' };
    case 'all':
      return { period: 'all', offerTypes, source: 'todos' };
    case 'custom':
      return {
        period: 'custom',
        offerTypes,
        source: 'todos',
        customDateFrom: customFrom,
        customDateTo: customTo,
      };
  }
}

interface FunnelStagePace {
  actual: number;
  alvo: number | null;
  expected: number | null;
  color: MetricColor | null;
}

// Safe division helper
function safeDivide(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `€${value.toFixed(0)}`;
}

function formatRatio(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(1);
}

const Marketing = () => {
  const { data: leads = [], isLoading: leadsLoading } = useRawLeads();
  const { data: movementsData, isLoading: movementsLoading } = useLeadMovements();
  const { opportunities: ghlOpportunities } = useGHLData();
  const { getCreativeName, getSpend } = useMetaCreativeNames();
  const { data: metaInsights = [] } = useMetaInsights();
  const { data: configs = [], isLoading: configsLoading } = useConfigStages();
  const { config: visualConfig } = useFunnelVisualConfig();
  const { getObjective, getObjectivesForMonth } = useMonthlyObjectives();
  const MARKETING_DEFAULTS = useMemo(() => ({ period: '30d' as string, oferta: 'all', from: undefined as string | undefined, to: undefined as string | undefined }), []);
  const [persistedFilters, setPersistedFilters] = usePersistedFilters('marketing-filters', MARKETING_DEFAULTS);
  const period = persistedFilters.period as MarketingPeriod;
  const oferta = persistedFilters.oferta;
  const customFrom = persistedFilters.from;
  const customTo = persistedFilters.to;
  const setPeriod = (v: MarketingPeriod) => setPersistedFilters({ period: v });
  const setOferta = (v: string) => setPersistedFilters({ oferta: v });
  const setCustomFrom = (v: string | undefined) => setPersistedFilters({ from: v });
  const setCustomTo = (v: string | undefined) => setPersistedFilters({ to: v });

  const sheetFilters = useMemo(() => toSheetFilterState(period, oferta, customFrom, customTo), [period, oferta, customFrom, customTo]);
  const { data: sheetData, isLoading: sheetLoading } = useSheetData(sheetFilters);

  const isLoading = leadsLoading || movementsLoading || configsLoading;

  // --- Drill-down filters (click on charts/tables to filter) ---
  type DrillKey = 'canal' | 'adSet' | 'criativo' | 'subcategoria';
  const [drillFilters, setDrillFilters] = useState<{ canal?: string; adSet?: string; criativo?: string; subcategoria?: string }>({});
  const toggleDrill = (key: DrillKey, value: string) =>
    setDrillFilters(prev => (prev[key] === value ? { ...prev, [key]: undefined } : { ...prev, [key]: value }));
  const clearDrill = () => setDrillFilters({});
  const hasDrill = Object.values(drillFilters).some(Boolean);

  // Reset drill filters when period/oferta change to avoid stale selections
  useEffect(() => { setDrillFilters({}); }, [period, oferta, customFrom, customTo]);

  const uniqueOfertas = useMemo(() => {
    const set = new Set(leads.map((l) => l.oferta).filter(Boolean));
    return Array.from(set).sort();
  }, [leads]);

  const { data: sourceMappings = [] } = useSourceMapping();

  const filteredAll = useMemo(() => filterLeads(leads, period, oferta, customFrom, customTo), [leads, period, oferta, customFrom, customTo]);

  const filtered = useMemo(() => {
    if (!hasDrill) return filteredAll;
    return filteredAll.filter((l) => {
      if (drillFilters.adSet && (l.adSet || 'Sem atribuição') !== drillFilters.adSet) return false;
      if (drillFilters.criativo && getCriativoLabel(l, sourceMappings, getCreativeName) !== drillFilters.criativo) return false;
      if (drillFilters.subcategoria && (l.subcategoria || 'Sem atribuição') !== drillFilters.subcategoria) return false;
      if (drillFilters.canal) {
        const raw = (l.fonte || '').trim();
        const canal = raw ? getCanal(raw, sourceMappings) : 'Sem atribuição';
        if (canal !== drillFilters.canal) return false;
      }
      return true;
    });
  }, [filteredAll, drillFilters, hasDrill, sourceMappings, getCreativeName]);

  const previousFiltered = useMemo(() => {
    const range = getDateRange(period, customFrom, customTo);
    const prev = getPreviousRange(period, range);
    return leads.filter((l) => {
      if (oferta !== 'all' && l.oferta !== oferta) return false;
      if (!l.dataRegisto) return false;
      const d = parseISO(l.dataRegisto);
      return d >= prev.from && d <= prev.to;
    });
  }, [leads, period, oferta, customFrom, customTo]);

  // --- Quality KPIs from movements ---
  const qualityMetrics = useMemo(() => {
    const movements = movementsData?.movements ?? [];
    const range = getDateRange(period, customFrom, customTo);

    // Determine relevant pipelines
    const pipelines = oferta === 'all'
      ? [...new Set(configs.map(c => c.pipeline_name))]
      : [oferta];

    // Filter ALL-TIME movements by relevant pipeline (do NOT filter by period yet)
    const relevantMovementsAllTime = movements.filter(m =>
      pipelines.some(p => m.pipeline.toLowerCase() === p.toLowerCase())
    );

    // SQL & Fechado stage sets, expanded with aliases from funnel_visual_config
    // (the visual funnel is the canonical source of truth for current/historical stages)
    const expandedSql = new Set<string>(
      pipelines.flatMap(p => getSQLStagesExpanded(p, configs, visualConfig))
    );
    const expandedFecho = new Set<string>(
      pipelines.flatMap(p => expandStagesWithAliases(['Fechado'], p, visualConfig))
    );

    // Count unique leads with any SQL/Fechado movement WITHIN the selected date range.
    // Aligned with PipelineFunnelCard logic: stage matched after trim, filter by movement date.
    const inRange = (d: Date) => period === 'all' || (d >= range.from && d <= range.to);

    const sqlLeads = new Set<string>();
    const sqlStageByLead = new Map<string, string>();
    const fechoLeads = new Set<string>();
    const fechoDateByLead = new Map<string, string>();
    const fechoIdByLead = new Map<string, string>();

    // SQL "any-time": leads que alguma vez (sem filtro de data) atingiram uma stage SQL
    // nas pipelines relevantes — usado para calcular SQLs de leads registadas no período.
    const sqlLeadsAnyTime = new Set<string>();

    // Quando há drill-down activo, restringimos os nomes considerados aos que
    // estão em `filtered` (já filtrado por canal/adSet/criativo/subcategoria).
    const drilledNames = hasDrill ? new Set(filtered.map(l => l.nome).filter(Boolean)) : null;
    const passesDrill = (nome: string) => !drilledNames || drilledNames.has(nome);

    for (const m of relevantMovementsAllTime) {
      const stage = m.stage.trim();
      if (expandedSql.has(stage) && passesDrill(m.nome)) sqlLeadsAnyTime.add(m.nome);

      if (!m.date) continue;
      const d = new Date(m.date);
      if (isNaN(d.getTime())) continue;
      if (!inRange(d)) continue;
      if (!passesDrill(m.nome)) continue;
      if (expandedSql.has(stage)) {
        sqlLeads.add(m.nome);
        if (!sqlStageByLead.has(m.nome)) sqlStageByLead.set(m.nome, stage);
      }
      if (expandedFecho.has(stage)) {
        fechoLeads.add(m.nome);
        // Keep the earliest fecho movement per lead (first time it closed)
        const existing = fechoDateByLead.get(m.nome);
        if (!existing || d < new Date(existing)) {
          fechoDateByLead.set(m.nome, m.date);
          fechoIdByLead.set(m.nome, m.id);
        }
      }
    }

    // SQLs de leads cujo registo (RAW_LEADS) caiu no período/oferta seleccionados
    const leadsDoPeriodoNomes = new Set(filtered.map(l => l.nome).filter(Boolean));
    let sqlsDeLeadsDoPeriodo = 0;
    leadsDoPeriodoNomes.forEach((nome) => {
      if (sqlLeadsAnyTime.has(nome)) sqlsDeLeadsDoPeriodo += 1;
    });

    return {
      sqls: sqlLeads.size,
      fechos: fechoLeads.size,
      sqlLeadNames: sqlLeads,
      sqlStageByLead,
      sqlsDeLeadsDoPeriodo,
      fechoLeadNames: fechoLeads,
      fechoDateByLead,
      fechoIdByLead,
      expandedSql,
      relevantMovementsAllTime,
    };
  }, [movementsData, configs, period, oferta, visualConfig, filtered, hasDrill]);

  // --- Weekly trend (last ~12 completed weeks, Mon-Sun) ---
  // Respects the `oferta` filter but IGNORES the period/date-range filter — always a fixed
  // trailing window. Reuses the same counting logic as qualityMetrics/RAW_LEADS above.
  const weeklyTrend = useMemo(() => {
    const movements = movementsData?.movements ?? [];
    const pipelines = oferta === 'all'
      ? [...new Set(configs.map(c => c.pipeline_name))]
      : [oferta];
    const expandedSql = new Set<string>(
      pipelines.flatMap(p => getSQLStagesExpanded(p, configs, visualConfig))
    );
    const relevantMovements = movements.filter(m =>
      pipelines.some(p => m.pipeline.toLowerCase() === p.toLowerCase())
    );

    const now = new Date();
    const WEEKS = 12;
    const weeks: { weekStart: Date; weekEnd: Date }[] = [];
    for (let i = WEEKS; i >= 1; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      weeks.push({ weekStart, weekEnd });
    }

    // Weekly target for Leads, derived from monthly_objectives.leads_alvo — the target for each
    // week is computed from the objective(s) valid in the month that week's Sunday falls in.
    const weeklyLeadsTargetForDate = (d: Date): number | null => {
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      if (oferta === 'all') {
        const objs = getObjectivesForMonth(monthKey);
        if (objs.length === 0) return null;
        const sum = objs.reduce((s, o) => s + (o.leadsAlvo || 0), 0);
        return sum > 0 ? weeklyTarget(sum) : null;
      }
      const obj = getObjective(oferta.toLowerCase(), monthKey);
      return obj ? weeklyTarget(obj.leadsAlvo) : null;
    };

    let hasAnyTarget = false;
    const data = weeks.map(({ weekStart, weekEnd }) => {
      const leadsCount = leads.filter(l => {
        if (oferta !== 'all' && l.oferta !== oferta) return false;
        if (!l.dataRegisto) return false;
        const d = parseISO(l.dataRegisto);
        return d >= weekStart && d <= weekEnd;
      }).length;

      const sqlSet = new Set<string>();
      relevantMovements.forEach(m => {
        if (!m.date) return;
        const stage = m.stage.trim();
        if (!expandedSql.has(stage)) return;
        const d = new Date(m.date);
        if (isNaN(d.getTime())) return;
        if (d >= weekStart && d <= weekEnd) sqlSet.add(m.nome);
      });
      const sqlCount = sqlSet.size;

      const taxa = leadsCount > 0 ? (sqlCount / leadsCount) * 100 : null;
      const leadsTarget = weeklyLeadsTargetForDate(weekEnd);
      if (leadsTarget !== null) hasAnyTarget = true;

      return {
        week: format(weekStart, 'dd/MM', { locale: pt }),
        leads: leadsCount,
        sql: sqlCount,
        taxa,
        leadsTarget,
      };
    });

    // Use a single representative weekly target (most recent week's target) for the ReferenceLine —
    // proportional targets rarely shift week to week within the same month.
    const lastTarget = data.length ? data[data.length - 1].leadsTarget : null;

    return { data, weeklyLeadsTarget: hasAnyTarget ? lastTarget : null };
  }, [leads, movementsData, configs, visualConfig, oferta, getObjective, getObjectivesForMonth]);

  // --- Pace do mês (funil: Lead → SQL → [Pré Aprovação] → Fechado) ---
  const monthPace = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const diasNoMes = getDaysInMonth(now);
    const diaActual = now.getDate();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const isCompra = oferta.toLowerCase() === 'compra';

    let leadsAlvo: number | null = null;
    let sqlsAlvo: number | null = null;
    let preAprovacaoAlvo: number | null = null;
    let fechosAlvo: number | null = null;
    let hasObjective = false;

    if (oferta === 'all') {
      const objs = getObjectivesForMonth(monthKey);
      if (objs.length > 0) {
        hasObjective = true;
        leadsAlvo = objs.reduce((s, o) => s + (o.leadsAlvo || 0), 0);
        sqlsAlvo = objs.reduce((s, o) => s + (o.sqlsAlvo || 0), 0);
        fechosAlvo = objs.reduce((s, o) => s + (o.fechosAlvo || 0), 0);
      }
    } else {
      const obj = getObjective(oferta.toLowerCase(), monthKey);
      if (obj) {
        hasObjective = true;
        leadsAlvo = obj.leadsAlvo;
        sqlsAlvo = obj.sqlsAlvo;
        fechosAlvo = obj.fechosAlvo;
        if (isCompra) preAprovacaoAlvo = obj.preAprovacaoAlvo;
      }
    }

    if (!hasObjective) {
      return { hasObjective: false as const };
    }

    const movements = movementsData?.movements ?? [];
    const pipelines = oferta === 'all'
      ? [...new Set(configs.map(c => c.pipeline_name))]
      : [oferta];
    const expandedSql = new Set<string>(
      pipelines.flatMap(p => getSQLStagesExpanded(p, configs, visualConfig))
    );
    const expandedFecho = new Set<string>(
      pipelines.flatMap(p => expandStagesWithAliases(['Fechado'], p, visualConfig))
    );
    const expandedPreAprovacao = new Set<string>(
      isCompra ? pipelines.flatMap(p => expandStagesWithAliases(['Pré Aprovação Submetida'], p, visualConfig)) : []
    );

    const mtdLeads = leads.filter(l => {
      if (oferta !== 'all' && l.oferta !== oferta) return false;
      if (!l.dataRegisto) return false;
      const d = parseISO(l.dataRegisto);
      return d >= monthStart && d <= now;
    }).length;

    const sqlSet = new Set<string>();
    const fechoSet = new Set<string>();
    const preAprovacaoSet = new Set<string>();
    movements.forEach(m => {
      if (!pipelines.some(p => m.pipeline.toLowerCase() === p.toLowerCase())) return;
      if (!m.date) return;
      const d = new Date(m.date);
      if (isNaN(d.getTime())) return;
      if (!(d >= monthStart && d <= now)) return;
      const stage = m.stage.trim();
      if (expandedSql.has(stage)) sqlSet.add(m.nome);
      if (expandedFecho.has(stage)) fechoSet.add(m.nome);
      if (isCompra && expandedPreAprovacao.has(stage)) preAprovacaoSet.add(m.nome);
    });
    const mtdSqls = sqlSet.size;
    const mtdFechos = fechoSet.size;
    const mtdPreAprovacao = preAprovacaoSet.size;

    const prorate = (alvo: number | null): number | null => {
      if (alvo === null || alvo <= 0 || diasNoMes <= 0) return null;
      return (alvo / diasNoMes) * diaActual;
    };

    const pctMes = diasNoMes > 0 ? (diaActual / diasNoMes) * 100 : 0;

    const stageFrom = (actual: number, alvo: number | null): FunnelStagePace => {
      const expected = prorate(alvo);
      const progressPct = alvo && alvo > 0 ? (actual / alvo) * 100 : null;
      const color: MetricColor | null = progressPct !== null && pctMes > 0 ? getPaceColor(progressPct) : null;
      return { actual, alvo, expected, color };
    };

    const stages: { key: string; label: string; pace: FunnelStagePace }[] = isCompra
      ? [
          { key: 'leads', label: 'Lead', pace: stageFrom(mtdLeads, leadsAlvo) },
          { key: 'sqls', label: 'SQL', pace: stageFrom(mtdSqls, sqlsAlvo) },
          { key: 'preAprovacao', label: 'Pré Aprovação Submetida', pace: stageFrom(mtdPreAprovacao, preAprovacaoAlvo) },
          { key: 'fechos', label: 'Fechado', pace: stageFrom(mtdFechos, fechosAlvo) },
        ]
      : [
          { key: 'leads', label: 'Lead', pace: stageFrom(mtdLeads, leadsAlvo) },
          { key: 'sqls', label: 'SQL', pace: stageFrom(mtdSqls, sqlsAlvo) },
          { key: 'fechos', label: 'Fechado', pace: stageFrom(mtdFechos, fechosAlvo) },
        ];

    return {
      hasObjective: true as const,
      diaActual,
      diasNoMes,
      stages,
    };
  }, [leads, movementsData, configs, visualConfig, oferta, getObjective, getObjectivesForMonth]);

  // Investment from sheetData — marketing-only: Ads + Referências (exclui custo comercial)
  const investmentBreakdown = sheetData?.investmentBreakdown;
  const investimento = investmentBreakdown
    ? investmentBreakdown.adsTotal + investmentBreakdown.referenciasTotal
    : null;
  const semInvestimento = investimento === null || investimento === 0;

  const totalLeads = filtered.length;
  const totalVariation = variation(filtered.length, previousFiltered.length);
  const { sqls, fechos, sqlsDeLeadsDoPeriodo } = qualityMetrics;
  // "MQL" agora é definido como o total de leads captados (RAW_LEADS) no período/oferta.
  const mqls = totalLeads;

  const taxaLeadSQL = safeDivide(sqls, totalLeads);
  const custoLead = semInvestimento ? null : safeDivide(investimento!, totalLeads);
  const custoSQL = semInvestimento ? null : safeDivide(investimento!, sqls);
  const cpa = semInvestimento ? null : safeDivide(investimento!, fechos);
  const sqlsFecho = safeDivide(sqls, fechos);

  const adSetCounts = useMemo(() => countByField(filtered, 'adSet'), [filtered]);
  const criativoCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((l) => {
      const label = getCriativoLabel(l, sourceMappings, getCreativeName);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, sourceMappings, getCreativeName]);
  const subcategoriaCounts = useMemo(() => countByField(filtered, 'subcategoria'), [filtered]);

  // Pre-compute a map of lead name → creative/fonte/dataRegisto for efficient lookup
  // Use ALL leads (not just filtered) to ensure conversions from any period/offer are matched
  const nameToCreativoMap = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach(lead => {
      if (lead.nome) {
        map.set(lead.nome, getCriativoLabel(lead, sourceMappings, getCreativeName));
      }
    });
    return map;
  }, [leads, sourceMappings, getCreativeName]);

  const nameToLeadMap = useMemo(() => {
    const map = new Map<string, RawLead>();
    leads.forEach(lead => {
      if (lead.nome) map.set(lead.nome, lead);
    });
    return map;
  }, [leads]);

  // Ticket (monetaryValue) por lead, via GHL — casamos primeiro por id (RAW_EVENTS.id === GHL contactId),
  // com fallback por nome (case-insensitive) quando o id não bate.
  const ghlByContactId = useMemo(() => {
    const map = new Map<string, number>();
    ghlOpportunities.forEach(o => {
      if (o.contactId) map.set(o.contactId, o.monetaryValue);
    });
    return map;
  }, [ghlOpportunities]);

  const ghlByName = useMemo(() => {
    const map = new Map<string, number>();
    ghlOpportunities.forEach(o => {
      const key = o.contactName?.trim().toLowerCase();
      if (key) map.set(key, o.monetaryValue);
    });
    return map;
  }, [ghlOpportunities]);

  // Conversões (Lead → Fecho): derivadas do RAW_EVENTS (dataFecho) em vez da sheet
  // manual "Base de Dados Drivers Fechados". Ticket vem do GHL (única fonte com valor monetário).
  const conversaoBreakdown = useMemo(() => {
    const { fechoLeadNames, fechoDateByLead, fechoIdByLead } = qualityMetrics;

    const conversoes = Array.from(fechoLeadNames).map((nome) => {
      const lead = nameToLeadMap.get(nome);
      const id = fechoIdByLead.get(nome);
      const ticket = (id && ghlByContactId.get(id)) ?? ghlByName.get(nome.trim().toLowerCase()) ?? null;

      return {
        id: id || nome,
        nome,
        ticket,
        dataRegisto: lead?.dataRegisto ?? null,
        dataFecho: fechoDateByLead.get(nome) ?? null,
        fonte: lead?.fonte || 'Sem atribuição',
        criativo: nameToCreativoMap.get(nome) || 'Sem atribuição',
      };
    }).sort((a, b) => {
      const dateA = a.dataFecho ? new Date(a.dataFecho).getTime() : 0;
      const dateB = b.dataFecho ? new Date(b.dataFecho).getTime() : 0;
      return dateB - dateA; // DESC
    });

    const withTicket = conversoes.filter(c => c.ticket !== null) as (typeof conversoes[number] & { ticket: number })[];
    const ticketMedio = withTicket.length ? withTicket.reduce((s, c) => s + c.ticket, 0) / withTicket.length : 0;

    return {
      conversoes,
      totalConversoes: conversoes.length,
      ticketMedio,
    };
  }, [qualityMetrics, nameToLeadMap, nameToCreativoMap, ghlByContactId, ghlByName]);
  // sourceMappings already declared above (used by drill-down filter)

  // Recomendações por criativo: junta leads/fechos (conversão) com o gasto real da Meta
  // (últimos 30 dias) e compara o custo-por-fecho de cada criativo com a média da própria
  // conta, em vez de usar um valor absoluto arbitrário — assim a recomendação adapta-se ao
  // que é "normal" para este negócio específico.
  type CriativoAction = 'aumentar' | 'reduzir' | 'pausar' | 'manter' | 'aguardar' | 'sem_dados';
  const criativoRecommendations = useMemo(() => {
    const MIN_LEADS = 10;

    const rows = criativoCounts
      .filter(c => c.label !== 'N/A' && c.label !== 'Sem atribuição')
      .map((c) => {
        const adIds = new Set<string>();
        filtered.forEach(l => {
          if (l.criativo && isMetaAdId(l.criativo) && getCreativeName(l.criativo) === c.label) {
            adIds.add(l.criativo);
          }
        });
        const spend = adIds.size > 0
          ? Array.from(adIds).reduce((sum, id) => sum + (getSpend(id) ?? 0), 0)
          : null;
        const fechos = conversaoBreakdown.conversoes.filter(cv => cv.criativo === c.label).length;
        const cpl = spend !== null && c.count > 0 ? spend / c.count : null;
        const custoPorFecho = spend !== null && fechos > 0 ? spend / fechos : null;

        return { label: c.label, leads: c.count, spend, fechos, cpl, custoPorFecho };
      });

    const withBaseline = rows.filter((r): r is typeof r & { custoPorFecho: number } => r.custoPorFecho !== null);
    const avgCustoPorFecho = withBaseline.length
      ? withBaseline.reduce((s, r) => s + r.custoPorFecho, 0) / withBaseline.length
      : null;

    return rows.map((r) => {
      let action: CriativoAction;
      let reason: string;

      if (r.leads < MIN_LEADS) {
        action = 'aguardar';
        reason = `Só ${r.leads} leads — amostra insuficiente para decidir.`;
      } else if (r.spend === null) {
        action = 'sem_dados';
        reason = 'Sem dados de gasto (criativo com nome antigo, anterior à migração para IDs do Meta).';
      } else if (r.fechos === 0 && r.spend > 0) {
        action = 'pausar';
        reason = `€${r.spend.toFixed(0)} gastos (30d) sem nenhum fecho.`;
      } else if (avgCustoPorFecho !== null && r.custoPorFecho !== null && r.custoPorFecho <= avgCustoPorFecho * 0.7) {
        action = 'aumentar';
        reason = `Custo por fecho €${r.custoPorFecho.toFixed(0)}, bem abaixo da média da conta (€${avgCustoPorFecho.toFixed(0)}).`;
      } else if (avgCustoPorFecho !== null && r.custoPorFecho !== null && r.custoPorFecho >= avgCustoPorFecho * 1.5) {
        action = 'reduzir';
        reason = `Custo por fecho €${r.custoPorFecho.toFixed(0)}, bem acima da média da conta (€${avgCustoPorFecho.toFixed(0)}).`;
      } else {
        action = 'manter';
        reason = avgCustoPorFecho !== null ? 'Dentro da média da conta.' : 'Sem base de comparação suficiente ainda.';
      }

      return { ...r, action, reason };
    }).sort((a, b) => {
      const order: Record<CriativoAction, number> = { pausar: 0, reduzir: 1, aumentar: 2, manter: 3, aguardar: 4, sem_dados: 5 };
      return order[a.action] - order[b.action];
    });
  }, [criativoCounts, filtered, getCreativeName, getSpend, conversaoBreakdown]);
  // Custo por SQL por Ad Set, com janela de maturação (ver src/lib/adSetQuality.ts).
  // Gasto/impressões/LP-views (meta_insights_daily) usam a mesma janela do período
  // seleccionado na página; para período "all" (sem janela de datas útil) caímos
  // para um fallback fixo de 30 dias.
  const adSetQualityWindow = useMemo(() => {
    if (period === 'all') {
      const to = new Date();
      const from = subDays(to, 30);
      return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd'), isFallback: true };
    }
    const range = getDateRange(period, customFrom, customTo);
    return { from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd'), isFallback: false };
  }, [period, customFrom, customTo]);

  // Stages para NLQ+ (Nova Lead Qualificada ou além — toda a stage após "Nova Lead"
  // no pipeline Compra), Pedidos Submetidos (Pré Aprovação Submetida) e Fechos
  // (Fechado), expandidas com aliases. Sem janela de maturação (ver adSetQuality.ts).
  const adSetQualityExtraStages = useMemo(() => {
    const pipelines = oferta === 'all'
      ? [...new Set(configs.map(c => c.pipeline_name))]
      : [oferta];
    const nlqStageNames = [
      'Nova Lead Qualificada', 'Não Atendeu (Lead Qualificada)', 'Oferta Apresentada',
      'Visita Marcada', 'Fechado', 'Pré Aprovação Submetida', 'Crédito Aprovado',
      'Financiamento Emitido', 'Em Processo', 'Acordo Verbal', 'Pesquisa Viatura',
      'Pedido de Financiamento', 'Financiamento Não Aprovado', 'Recolha Docs Financiamento',
      'Avaliação Financiamento', 'Cálculo Retoma', 'Visita Interessado', 'Pedido de Docs',
      'Visita Interesado', 'Visita de Fecho', 'No Show (Visita Interessado)',
      'Crédito Não Aprovado', 'Em Análise', 'Pedido Retoma (Stock)', 'Pedido de Consultoria',
      'Envio Docs Crédito', 'No Show (Visita de Fecho)', 'Visita Fecho Marcada',
    ];
    return {
      nlqStages: new Set<string>(pipelines.flatMap(p => expandStagesWithAliases(nlqStageNames, p, visualConfig))),
      submetidaStages: new Set<string>(pipelines.flatMap(p => expandStagesWithAliases(['Pré Aprovação Submetida'], p, visualConfig))),
      fechoStages: new Set<string>(pipelines.flatMap(p => expandStagesWithAliases(['Fechado'], p, visualConfig))),
    };
  }, [oferta, configs, visualConfig]);

  const adSetQualityRows = useMemo(() => {
    return computeAdSetQualityMetrics(
      filtered,
      qualityMetrics.relevantMovementsAllTime,
      qualityMetrics.expandedSql,
      getCreativeName,
      metaInsights,
      adSetQualityWindow.from,
      adSetQualityWindow.to,
      new Date(),
      adSetQualityExtraStages.nlqStages,
      adSetQualityExtraStages.submetidaStages,
      adSetQualityExtraStages.fechoStages,
    );
  }, [filtered, qualityMetrics.relevantMovementsAllTime, qualityMetrics.expandedSql, getCreativeName, metaInsights, adSetQualityWindow, adSetQualityExtraStages]);

  const fonteCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((l) => {
      const raw = (l.fonte || '').trim();
      const canal = raw ? getCanal(raw, sourceMappings) : 'Sem atribuição';
      map.set(canal, (map.get(canal) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, sourceMappings]);
  const fonteTotal = useMemo(() => fonteCounts.reduce((s, f) => s + f.count, 0), [fonteCounts]);

  // Drill-down dialog (lista de leads contadas num card)
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillKind, setDrillKind] = useState<'mql' | 'sql'>('mql');
  const [showConversaoBreakdown, setShowConversaoBreakdown] = useState(false);

  const mqlLeadsList = useMemo<LeadsListDialogLead[]>(() => rawLeadsToDialog(filtered), [filtered]);

  const sqlLeadsList = useMemo<LeadsListDialogLead[]>(() => {
    const names = qualityMetrics.sqlLeadNames;
    if (!names || names.size === 0) return [];
    const byName = new Map<string, RawLead>();
    for (const l of leads) {
      if (l.nome && !byName.has(l.nome)) byName.set(l.nome, l);
    }
    const list: LeadsListDialogLead[] = [];
    names.forEach((nome) => {
      const raw = byName.get(nome);
      const stage = qualityMetrics.sqlStageByLead.get(nome) ?? '';
      if (raw) {
        list.push({ id: raw.id, nome: raw.nome, oferta: raw.oferta, dataRegisto: raw.dataRegisto, fonte: raw.fonte, stage });
      } else {
        list.push({ id: `sql-missing-${nome}`, nome, oferta: '', dataRegisto: null, fonte: '', missing: true, stage });
      }
    });
    return list;
  }, [qualityMetrics.sqlLeadNames, qualityMetrics.sqlStageByLead, leads]);

  const drillData = drillKind === 'mql'
    ? {
        title: `Leads contadas em "MQL" (${mqlLeadsList.length})`,
        description: 'Fonte: RAW_LEADS — leads captadas no período e oferta seleccionados (data de registo).',
        leads: mqlLeadsList,
      }
    : {
        title: `Leads contadas em "SQL" (${sqlLeadsList.length})`,
        description:
          'Fonte: RAW_EVENTS — leads únicas que tiveram um movimento para uma stage SQL dentro do período.\nOferta/Data/Fonte vêm do cruzamento com RAW_LEADS. Leads antigos podem aparecer sem registo (marcados como "fora de RAW_LEADS").',
        leads: sqlLeadsList,
      };


  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header + Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Marketing</h1>
            <p className="text-sm text-muted-foreground">Análise de leads e campanhas</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={period} onValueChange={(v) => setPeriod(v as MarketingPeriod)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {period === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFrom ? format(parseISO(customFrom), 'dd/MM/yyyy') : 'Data início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom ? parseISO(customFrom) : undefined}
                      onSelect={(d) => d && setCustomFrom(format(d, 'yyyy-MM-dd'))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customTo ? format(parseISO(customTo), 'dd/MM/yyyy') : 'Data fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo ? parseISO(customTo) : undefined}
                      onSelect={(d) => d && setCustomTo(format(d, 'yyyy-MM-dd'))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
            <Select value={oferta} onValueChange={setOferta}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ofertas</SelectItem>
                {uniqueOfertas.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active drill-down filter chips */}
        {hasDrill && (
          <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-xs text-muted-foreground font-medium">Filtros activos:</span>
            {(['canal', 'adSet', 'criativo', 'subcategoria'] as const).map((k) => {
              const v = drillFilters[k];
              if (!v) return null;
              const labelMap = { canal: 'Fonte', adSet: 'Ad Set', criativo: 'Criativo', subcategoria: 'Subcategoria' } as const;
              return (
                <Badge key={k} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  <span className="text-xs">{labelMap[k]}: <strong>{v}</strong></span>
                  <button
                    type="button"
                    onClick={() => setDrillFilters(prev => ({ ...prev, [k]: undefined }))}
                    className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`Remover filtro ${labelMap[k]}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearDrill}>Limpar todos</Button>
          </div>
        )}

        <Tabs defaultValue="visao-geral" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="meta-ads">Meta Ads</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-6">
        {/* Ritmo do Mês (Leads & SQLs) */}
        {monthPace.hasObjective && (
          <Card className="glass-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-medium text-foreground">Ritmo do Mês</CardTitle>
                <Link to="/" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  Ver Progresso Mensal completo <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-0">
                {(() => {
                  const baseActual = Math.max(1, monthPace.stages[0]?.pace.actual ?? 1);
                  return monthPace.stages.map(({ key, label, pace }, idx) => {
                    const color = pace.color;
                    const bgClass = color === 'red' ? 'bg-rose-500/10' : color === 'yellow' ? 'bg-yellow-400/10' : color === 'green' ? 'bg-emerald-500/10' : 'bg-muted/40';
                    const borderClass = color === 'red' ? 'border-rose-500/40' : color === 'yellow' ? 'border-yellow-400/40' : color === 'green' ? 'border-emerald-500/40' : 'border-border/50';
                    const textClass = color === 'red' ? 'text-rose-400' : color === 'yellow' ? 'text-yellow-400' : color === 'green' ? 'text-emerald-400' : 'text-muted-foreground';
                    const badgeLabel = color === 'red' ? 'Atrasado' : color === 'yellow' ? 'Atenção' : color === 'green' ? 'No ritmo' : '—';
                    // Funnel width: proportional to volume relative to the first stage, clamped so later stages stay readable.
                    const widthPct = Math.max(38, Math.min(100, (pace.actual / baseActual) * 100));
                    return (
                      <div key={key} className="flex flex-col items-center w-full">
                        <div
                          className={`rounded-2xl border ${bgClass} ${borderClass} px-6 py-4 w-full flex flex-col items-center text-center gap-2 transition-all`}
                          style={{ maxWidth: `${widthPct}%` }}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-background/60 text-[11px] font-medium text-foreground/70 shrink-0">{idx + 1}</span>
                            <p className="text-xs font-medium uppercase tracking-wide text-foreground/80">{label}</p>
                          </div>
                          <div className="flex items-baseline justify-center gap-1.5">
                            <span className="text-3xl font-bold text-foreground leading-none">{pace.actual}</span>
                            {pace.alvo !== null && <span className="text-sm text-muted-foreground">/ {pace.alvo}</span>}
                          </div>
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {color && <Badge variant="outline" className={cn('text-[10px] font-medium', textClass, borderClass)}>{badgeLabel}</Badge>}
                            <p className="text-[11px] text-muted-foreground">
                              Esperado: {pace.expected !== null ? Math.round(pace.expected) : '—'}
                            </p>
                          </div>
                        </div>
                        {idx < monthPace.stages.length - 1 && (
                          <div className="h-3 w-px bg-border/60" />
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Progresso do mês: dia {monthPace.diaActual} de {monthPace.diasNoMes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tendência Semanal */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">Tendência Semanal (últimas 12 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {weeklyTrend.data.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sem dados disponíveis
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrend.data} margin={{ left: 4, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Taxa Lead → SQL') return [value !== null ? `${value.toFixed(1)}%` : '—', name];
                        return [value, name];
                      }}
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-xs text-muted-foreground">{value}</span>
                      )}
                    />
                    {weeklyTrend.weeklyLeadsTarget !== null && (
                      <ReferenceLine
                        yAxisId="left"
                        y={weeklyTrend.weeklyLeadsTarget}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="4 4"
                        label={{ value: 'Objectivo semanal (Leads)', fill: 'hsl(var(--muted-foreground))', fontSize: 10, position: 'insideTopRight' }}
                      />
                    )}
                    <Line yAxisId="left" type="monotone" dataKey="leads" name="Leads" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="left" type="monotone" dataKey="sql" name="SQL" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="taxa" name="Taxa Lead → SQL" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quality KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="MQL"
            value={mqls.toString()}
            variation={totalVariation}
            icon={<Users className="h-4 w-4" />}
            delay={0}
            tooltip={`Marketing Qualified Leads — total de leads captadas no período e oferta seleccionados (RAW_LEADS).\nValor: ${mqls}\n\nClica para ver a lista detalhada.`}
            onClick={() => { setDrillKind('mql'); setDrillOpen(true); }}
          />
          <KPICard
            title="SQL"
            value={sqls.toString()}
            secondaryValue={sqlsDeLeadsDoPeriodo.toString()}
            secondaryLabel="de leads do período"
            icon={<TrendingUp className="h-4 w-4" />}
            delay={0.1}
            tooltip={`SQL no período: ${sqls} — leads que atingiram uma stage SQL dentro do período seleccionado (independentemente de quando foram registadas).\n\nSQL de leads do período: ${sqlsDeLeadsDoPeriodo} — leads cujo registo (RAW_LEADS) caiu neste período e que, em algum momento, atingiram uma stage SQL.\n\nClica para ver a lista detalhada (SQL no período).`}
            onClick={() => { setDrillKind('sql'); setDrillOpen(true); }}
          />
          <KPICard
            title="Taxa Lead → SQL"
            value={taxaLeadSQL !== null ? `${(taxaLeadSQL * 100).toFixed(1)}%` : '—'}
            icon={<Percent className="h-4 w-4" />}
            delay={0.15}
            tooltip={`SQLs ÷ MQLs = ${sqls} ÷ ${mqls} = ${mqls > 0 ? ((sqls / mqls) * 100).toFixed(1) + '%' : '—'}`}
          />
          <KPICard
            title="Investimento"
            value={hasDrill ? '—' : (semInvestimento ? 'Sem dados' : `€${investimento!.toFixed(0)}`)}
            icon={<DollarSign className="h-4 w-4" />}
            delay={0.18}
            tooltip={
              hasDrill
                ? 'Investimento não disponível com filtros de drill-down activos (a granularidade das folhas de investimento não permite separar por fonte / ad set / criativo / subcategoria).'
                : semInvestimento
                  ? 'Sem investimento de Ads nem referências no período/oferta'
                  : `Investimento de marketing no período: €${investimento!.toFixed(0)}\n• Ads: €${investmentBreakdown!.adsTotal.toFixed(0)}\n• Referências: €${investmentBreakdown!.referenciasTotal.toFixed(0)}\nNão inclui custo comercial.`
            }
          />
          <KPICard
            title="Custo por Lead"
            value={hasDrill ? '—' : (semInvestimento ? 'Sem dados' : formatCurrency(custoLead))}
            icon={<DollarSign className="h-4 w-4" />}
            delay={0.2}
            tooltip={hasDrill ? 'Indisponível com filtros de drill-down activos.' : (semInvestimento ? 'Sem dados de investimento para o período' : `Investimento ÷ MQLs = €${investimento!.toFixed(0)} ÷ ${mqls} = ${formatCurrency(custoLead)}`)}
          />
          <KPICard
            title="Custo por SQL"
            value={hasDrill ? '—' : (semInvestimento ? 'Sem dados' : formatCurrency(custoSQL))}
            icon={<DollarSign className="h-4 w-4" />}
            delay={0.25}
            tooltip={hasDrill ? 'Indisponível com filtros de drill-down activos.' : (semInvestimento ? 'Sem dados de investimento para o período' : `Investimento ÷ SQLs = €${investimento!.toFixed(0)} ÷ ${sqls} = ${formatCurrency(custoSQL)}`)}
          />
          <KPICard
            title="CPA"
            value={hasDrill ? '—' : (semInvestimento ? 'Sem dados' : formatCurrency(cpa))}
            icon={<DollarSign className="h-4 w-4" />}
            delay={0.3}
            tooltip={hasDrill ? 'Indisponível com filtros de drill-down activos.' : (semInvestimento ? 'Sem dados de investimento para o período' : `Custo por Aquisição: Investimento ÷ Fechos = €${investimento!.toFixed(0)} ÷ ${fechos} = ${formatCurrency(cpa)}`)}
          />
          <KPICard
            title="SQLs para Fecho"
            value={formatRatio(sqlsFecho)}
            icon={<Target className="h-4 w-4" />}
            delay={0.35}
            tooltip={fechos > 0 ? `SQLs ÷ Fechos = ${sqls} ÷ ${fechos} = ${formatRatio(sqlsFecho)}` : `SQLs ÷ Fechos = ${sqls} ÷ 0 — sem fechos no período`}
          />
          <KPICard
            title="Conversões"
            value={conversaoBreakdown.totalConversoes.toString()}
            secondaryValue={`€${conversaoBreakdown.ticketMedio.toFixed(0)}`}
            secondaryLabel="ticket médio"
            icon={<TrendingUp className="h-4 w-4" />}
            delay={0.4}
            tooltip="Total de leads que passaram de MQL a Fechado (conversão real)"
            onClick={() => setShowConversaoBreakdown(true)}
          />
        </div>

        {/* Distribuição por Fonte */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="text-base font-medium text-foreground">Distribuição por Fonte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {fonteCounts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Sem dados disponíveis
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fonteCounts}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        label={({ percent }) => `${((percent || 0) * 100).toFixed(1)}%`}
                        labelLine={false}
                        onClick={(data: any) => data?.label && toggleDrill('canal', data.label)}
                        style={{ cursor: 'pointer' }}
                      >
                        {fonteCounts.map((f, i) => {
                          const isSelected = drillFilters.canal === f.label;
                          const dimmed = drillFilters.canal && !isSelected;
                          return (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                              fillOpacity={dimmed ? 0.3 : 1}
                              stroke={isSelected ? 'hsl(var(--primary))' : 'none'}
                              strokeWidth={isSelected ? 2 : 0}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number, name: string) => [
                          `${value} leads (${fonteTotal ? ((value / fonteTotal) * 100).toFixed(1) : 0}%)`,
                          name,
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {fonteCounts.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {fonteCounts.map((f, i) => {
                    const isSelected = drillFilters.canal === f.label;
                    const dimmed = drillFilters.canal && !isSelected;
                    return (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => toggleDrill('canal', f.label)}
                        className={cn(
                          "w-full flex items-center justify-between text-xs rounded px-2 py-1 transition-colors hover:bg-muted/40 cursor-pointer text-left",
                          isSelected && "bg-primary/10 ring-1 ring-primary/40",
                          dimmed && "opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-sm shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="text-muted-foreground truncate">{f.label}</span>
                        </div>
                        <span className="text-foreground font-mono tabular-nums">
                          {f.count} ({fonteTotal ? ((f.count / fonteTotal) * 100).toFixed(1) : 0}%)
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Breakdown por Subcategoria */}
        <div>
          <h2 className="text-base font-medium text-foreground mb-4">Breakdown por Subcategoria</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subcategoriaCounts.map((s, i) => {
              const isSelected = drillFilters.subcategoria === s.label;
              const dimmed = drillFilters.subcategoria && !isSelected;
              return (
                <div key={s.label} className={cn(dimmed && "opacity-50 transition-opacity")}>
                  <KPICard
                    title={s.label}
                    value={s.count.toString()}
                    icon={<Layers className="h-4 w-4" />}
                    delay={0.05 * i}
                    onClick={() => toggleDrill('subcategoria', s.label)}
                    selected={isSelected}
                    tooltip={`Clica para ${isSelected ? 'remover' : 'aplicar'} filtro por subcategoria "${s.label}".`}
                  />
                </div>
              );
            })}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="meta-ads" className="space-y-6">
        {/* Breakdown por Ad Set */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">Breakdown por Ad Set</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adSetCounts} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value: number) => [
                      `${value} (${filtered.length ? ((value / filtered.length) * 100).toFixed(1) : 0}%)`,
                      'Leads',
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    onClick={(data: any) => data?.label && toggleDrill('adSet', data.label)}
                    style={{ cursor: 'pointer' }}
                  >
                    {adSetCounts.map((a, i) => {
                      const isSelected = drillFilters.adSet === a.label;
                      const dimmed = drillFilters.adSet && !isSelected;
                      return (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          fillOpacity={dimmed ? 0.3 : 1}
                          stroke={isSelected ? 'hsl(var(--primary))' : 'none'}
                          strokeWidth={isSelected ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Custo por SQL (Ad Set / Criativo) */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">Custo por SQL (Ad Set / Criativo)</CardTitle>
          </CardHeader>
          <CardContent>
            <AdSetQualityTable rows={adSetQualityRows} isLoading={isLoading} usingFallbackWindow={adSetQualityWindow.isFallback} />
          </CardContent>
        </Card>

        {/* Breakdown por Criativo */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">Breakdown por Criativo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criativo</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criativoCounts.map((c) => {
                  const isSelected = drillFilters.criativo === c.label;
                  const dimmed = drillFilters.criativo && !isSelected;
                  // Count conversões (RAW_EVENTS fecho) whose lead name maps to this creative
                  const conversoesCriativo = conversaoBreakdown.conversoes.filter(
                    c2 => c2.criativo === c.label
                  ).length;
                  return (
                    <TableRow
                      key={c.label}
                      onClick={() => toggleDrill('criativo', c.label)}
                      className={cn(
                        "cursor-pointer hover:bg-muted/40 transition-colors",
                        isSelected && "bg-primary/10",
                        dimmed && "opacity-50"
                      )}
                    >
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right">
                        {filtered.length ? ((c.count / filtered.length) * 100).toFixed(1) : 0}%
                      </TableCell>
                      <TableCell className="text-right font-medium">{conversoesCriativo}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recomendações por Criativo */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">Recomendações por Criativo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criativo</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Gasto (30d)</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Custo/Fecho</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criativoRecommendations.map((r) => {
                  const actionBadge: Record<typeof r.action, { label: string; className: string }> = {
                    aumentar: { label: 'Aumentar budget', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                    reduzir: { label: 'Reduzir budget', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
                    pausar: { label: 'Pausar/rever', className: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
                    manter: { label: 'Manter', className: 'bg-muted text-muted-foreground border-border' },
                    aguardar: { label: 'Aguardar dados', className: 'bg-muted text-muted-foreground border-border' },
                    sem_dados: { label: 'Sem dados de gasto', className: 'bg-muted text-muted-foreground border-border' },
                  };
                  const badge = actionBadge[r.action];
                  return (
                    <TableRow key={r.label}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-right">{r.leads}</TableCell>
                      <TableCell className="text-right">{r.spend !== null ? `€${r.spend.toFixed(0)}` : '—'}</TableCell>
                      <TableCell className="text-right">{r.cpl !== null ? `€${r.cpl.toFixed(1)}` : '—'}</TableCell>
                      <TableCell className="text-right">{r.custoPorFecho !== null ? `€${r.custoPorFecho.toFixed(0)}` : '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={badge.className}>{badge.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">{r.reason}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3">
              Gasto dos últimos 30 dias via Meta Ads. Custo/Fecho comparado com a média da própria conta — sem base de comparação suficiente, mostra "sem dados de gasto".
            </p>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      <LeadsListDialog
        open={drillOpen}
        onOpenChange={setDrillOpen}
        title={drillData.title}
        description={drillData.description}
        leads={drillData.leads}
        showStageColumn={drillKind === 'sql'}
      />

      <ConversaoBreakdownDialog
        open={showConversaoBreakdown}
        onOpenChange={setShowConversaoBreakdown}
        breakdown={conversaoBreakdown}
      />
    </DashboardLayout>
  );
};

export default Marketing;
