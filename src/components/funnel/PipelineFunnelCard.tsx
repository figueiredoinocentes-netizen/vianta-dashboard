import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CHART_PALETTE } from '@/data/mockData';
import { useFunnelVisualConfig } from '@/hooks/useFunnelVisualConfig';
import { useConfigStages, getMQLStagesExpanded, getSQLStagesExpanded, getContactadosConfigExpanded } from '@/hooks/useConfigStages';
import type { RawMovement } from '@/hooks/useLeadMovements';
import type { FunnelVisualConfig, PipelineStageConfig } from '@/types/dashboard';

export type TimeMode = 'quarter' | 'month' | 'year' | 'last_week';

export function getLastWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 1=Mon ...
  const daysSinceMonday = (dow + 6) % 7;
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(lastSunday.getDate() - 1);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { start: lastMonday, end: thisMonday, label: `${fmt(lastMonday)} – ${fmt(lastSunday)}` };
}

interface Props {
  movements: RawMovement[];
  pipelineName: string;
  // Controlled mode props
  timeMode?: TimeMode;
  onTimeModeChange?: (v: TimeMode) => void;
  selectedQuarter?: string;
  onSelectedQuarterChange?: (v: string) => void;
  selectedMonth?: string;
  onSelectedMonthChange?: (v: string) => void;
  selectedYear?: string;
  onSelectedYearChange?: (v: string) => void;
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function filterByDateRange(movements: RawMovement[], start: Date, end: Date): RawMovement[] {
  return movements.filter(m => {
    const d = new Date(m.date);
    return d >= start && d < end;
  });
}

/** Count unique leads that have at least one movement matching the given CRM stage name or any alias */
function countLeadsInStage(movements: RawMovement[], stageName: string, aliases: string[] = []): number {
  const ids = new Set<string>();
  for (const m of movements) {
    const s = m.stage.trim();
    if (s === stageName || aliases.includes(s)) ids.add(m.id);
  }
  return ids.size;
}

/** Count unique leads matching a metric rule (stages already expanded with aliases) */
function countMetricLeads(
  movements: RawMovement[],
  metricConfig: PipelineStageConfig,
  allConfigs: PipelineStageConfig[],
  visualConfig: FunnelVisualConfig[],
  pipelineName: string
): number {
  const ids = new Set<string>();
  if (metricConfig.rule_type === 'match_stages') {
    const stages = getMQLStagesExpanded(pipelineName, allConfigs, visualConfig);
    for (const m of movements) {
      if (stages.includes(m.stage.trim())) ids.add(m.id);
    }
  } else if (metricConfig.rule_type === 'reached_any') {
    const stages = getSQLStagesExpanded(pipelineName, allConfigs, visualConfig);
    for (const m of movements) {
      if (stages.includes(m.stage.trim())) ids.add(m.id);
    }
  } else if (metricConfig.rule_type === 'contacted') {
    const cfg = getContactadosConfigExpanded(pipelineName, allConfigs, visualConfig);
    for (const m of movements) {
      const s = m.stage.trim();
      if (cfg.stages.includes(s) && (!cfg.prefixoExcluir || !s.startsWith(cfg.prefixoExcluir))) {
        ids.add(m.id);
      }
    }
  }
  return ids.size;
}


export function getWeeksOfMonth(year: number, month: number): { start: Date; end: Date; label: string }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: { start: Date; end: Date; label: string }[] = [];
  let current = new Date(firstDay);
  let weekNum = 1;

  while (current <= lastDay) {
    const weekStart = new Date(current);
    let weekEnd = new Date(current);
    if (current.getDay() === 0) {
      weekEnd.setDate(weekEnd.getDate() + 6);
    } else {
      while (weekEnd.getDay() !== 6) weekEnd.setDate(weekEnd.getDate() + 1);
    }
    if (weekEnd > lastDay) weekEnd = new Date(lastDay);

    const endExclusive = new Date(weekEnd);
    endExclusive.setDate(endExclusive.getDate() + 1);
    endExclusive.setHours(0, 0, 0, 0);

    weeks.push({
      start: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()),
      end: endExclusive,
      label: `Sem ${weekNum}`,
    });
    weekNum++;
    current = new Date(endExclusive);
  }
  return weeks;
}

export function getAvailableQuarters(movements: RawMovement[]) {
  const set = new Set<string>();
  for (const m of movements) {
    const d = new Date(m.date);
    set.add(`${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`);
  }
  return Array.from(set).sort().reverse().map(s => {
    const [y, q] = s.split('-Q');
    return { year: parseInt(y), quarter: parseInt(q), label: `Q${q} ${y}` };
  });
}

export function getAvailableYears(movements: RawMovement[]) {
  const set = new Set<number>();
  for (const m of movements) {
    set.add(new Date(m.date).getFullYear());
  }
  return Array.from(set).sort((a, b) => b - a).map(y => ({ year: y, label: String(y) }));
}

export function getAvailableMonths(movements: RawMovement[]) {
  const set = new Set<string>();
  for (const m of movements) {
    const d = new Date(m.date);
    set.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`);
  }
  return Array.from(set).sort().reverse().map(s => {
    const [y, mo] = s.split('-');
    const month = parseInt(mo);
    return { year: parseInt(y), month, label: `${MONTHS_PT[month]} ${y}` };
  });
}

export function PipelineFunnelCard({
  movements,
  pipelineName,
  timeMode: controlledTimeMode,
  onTimeModeChange,
  selectedQuarter: controlledQuarter,
  onSelectedQuarterChange,
  selectedMonth: controlledMonth,
  onSelectedMonthChange,
  selectedYear: controlledYear,
  onSelectedYearChange,
}: Props) {
  const pipelineMovements = useMemo(() => movements.filter(m => m.pipeline === pipelineName), [movements, pipelineName]);
  const { config: visualConfig, isLoading: configLoading } = useFunnelVisualConfig();
  const { data: allConfigs, isLoading: configStagesLoading } = useConfigStages();

  // Internal state (fallback when not controlled)
  const [internalTimeMode, setInternalTimeMode] = useState<TimeMode>('quarter');
  const timeMode = controlledTimeMode ?? internalTimeMode;
  const setTimeMode = onTimeModeChange ?? setInternalTimeMode;

  const quarters = useMemo(() => getAvailableQuarters(pipelineMovements), [pipelineMovements]);
  const months = useMemo(() => getAvailableMonths(pipelineMovements), [pipelineMovements]);
  const years = useMemo(() => getAvailableYears(pipelineMovements), [pipelineMovements]);

  const [internalQuarter, setInternalQuarter] = useState<string>(() => quarters[0]?.label || '');
  const [internalMonth, setInternalMonth] = useState<string>(() => months[0]?.label || '');
  const [internalYear, setInternalYear] = useState<string>(() => years[0]?.label || '');

  const selectedQuarter = controlledQuarter ?? internalQuarter;
  const setSelectedQuarter = onSelectedQuarterChange ?? setInternalQuarter;
  const selectedMonth = controlledMonth ?? internalMonth;
  const setSelectedMonth = onSelectedMonthChange ?? setInternalMonth;
  const selectedYear = controlledYear ?? internalYear;
  const setSelectedYear = onSelectedYearChange ?? setInternalYear;

  useMemo(() => {
    if (quarters.length > 0 && !quarters.find(q => q.label === selectedQuarter)) setSelectedQuarter(quarters[0].label);
    if (months.length > 0 && !months.find(m => m.label === selectedMonth)) setSelectedMonth(months[0].label);
    if (years.length > 0 && !years.find(y => y.label === selectedYear)) setSelectedYear(years[0].label);
  }, [pipelineName, quarters, months, years]);

  const columns = useMemo(() => {
    if (timeMode === 'last_week') {
      const r = getLastWeekRange();
      return [{ label: r.label, start: r.start, end: r.end }];
    }
    if (timeMode === 'year') {
      const y = years.find(y => y.label === selectedYear);
      if (!y) return [];
      return Array.from({ length: 12 }, (_, i) => ({
        label: MONTHS_PT[i],
        start: new Date(y.year, i, 1),
        end: new Date(y.year, i + 1, 1),
      }));
    } else if (timeMode === 'quarter') {
      const q = quarters.find(q => q.label === selectedQuarter);
      if (!q) return [];
      const startMonth = (q.quarter - 1) * 3;
      return [0, 1, 2].map(i => {
        const m = startMonth + i;
        return { label: MONTHS_PT[m], start: new Date(q.year, m, 1), end: new Date(q.year, m + 1, 1) };
      });
    } else {
      const m = months.find(m => m.label === selectedMonth);
      if (!m) return [];
      return getWeeksOfMonth(m.year, m.month);
    }
  }, [timeMode, selectedQuarter, selectedMonth, selectedYear, quarters, months, years]);

  const totalRange = useMemo(() => {
    if (columns.length === 0) return null;
    return { start: columns[0].start, end: columns[columns.length - 1].end };
  }, [columns]);

  // Build visual stages EXCLUSIVELY from funnel_visual_config
  const stages = useMemo(() => {
    const pipelineVisual = visualConfig
      .filter(v => v.pipeline === pipelineName && v.visivel)
      .sort((a, b) => a.ordem - b.ordem);

    if (pipelineVisual.length === 0) {
      const seen = new Set<string>();
      const fallback: { stage: string; ordem: number; aliases: string[] }[] = [];
      for (const m of pipelineMovements) {
        const s = m.stage.trim();
        if (!seen.has(s)) {
          seen.add(s);
          fallback.push({ stage: s, ordem: fallback.length, aliases: [] });
        }
      }
      return fallback;
    }

    return pipelineVisual.map(v => ({ stage: v.stage, ordem: v.ordem, aliases: v.aliases ?? [] }));
  }, [visualConfig, pipelineName, pipelineMovements]);

  const configs = allConfigs ?? [];

  const tableData = useMemo(() => {
    if (!totalRange || stages.length === 0) return [];
    const totalMvs = filterByDateRange(pipelineMovements, totalRange.start, totalRange.end);
    const stageRows = stages.map(s => {
      const metricConfig = configs.find(c => c.pipeline_name === pipelineName && c.stage_label === s.stage);

      const countFn = (mvs: RawMovement[]) =>
        metricConfig
          ? countMetricLeads(mvs, metricConfig, configs, visualConfig, pipelineName)
          : countLeadsInStage(mvs, s.stage, s.aliases);

      const colValues = columns.map(col => {
        const filtered = filterByDateRange(pipelineMovements, col.start, col.end);
        return countFn(filtered);
      });
      const total = countFn(totalMvs);
      return { key: s.stage, label: s.stage, colValues, total, metricType: metricConfig?.rule_type as string | undefined };
    });

    // Synthetic SQL row prepended on top — respects current time/pipeline filters
    const sqlStages = getSQLStagesExpanded(pipelineName, configs, visualConfig);
    const countSqlIn = (mvs: RawMovement[]) => {
      const ids = new Set<string>();
      for (const m of mvs) if (sqlStages.includes(m.stage.trim())) ids.add(m.id);
      return ids.size;
    };
    const sqlRow = {
      key: '__sql__',
      label: 'SQL',
      colValues: columns.map(c => countSqlIn(filterByDateRange(pipelineMovements, c.start, c.end))),
      total: countSqlIn(totalMvs),
      metricType: 'reached_any' as string | undefined,
    };

    // Avoid duplicate SQL row if a visual stage already maps to reached_any
    const dedupedStageRows = stageRows.filter(r => r.metricType !== 'reached_any');
    return [sqlRow, ...dedupedStageRows];
  }, [pipelineMovements, columns, totalRange, stages, configs, pipelineName, visualConfig]);

  const maxTotal = useMemo(() => Math.max(...tableData.map(r => r.total), 1), [tableData]);
  const sqlTotal = useMemo(() => {
    const sqlRow = tableData.find(r => r.metricType === 'reached_any');
    return sqlRow?.total ?? 0;
  }, [tableData]);

  if (configLoading || configStagesLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">A carregar configuração...</p>
        </CardContent>
      </Card>
    );
  }

  if (pipelineMovements.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">Sem dados para a pipeline {pipelineName}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pipeline — {pipelineName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={timeMode} onValueChange={v => setTimeMode(v as TimeMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="year" className="text-xs px-3 h-7">Ano</TabsTrigger>
                <TabsTrigger value="quarter" className="text-xs px-3 h-7">Trimestre</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-3 h-7">Mês</TabsTrigger>
                <TabsTrigger value="last_week" className="text-xs px-3 h-7">Sem. Passada</TabsTrigger>
              </TabsList>
            </Tabs>
            {timeMode === 'year' && years.length > 0 && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y.label} value={y.label}>{y.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {timeMode === 'quarter' && quarters.length > 0 && (
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {quarters.map(q => <SelectItem key={q.label} value={q.label}>{q.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {timeMode === 'month' && months.length > 0 && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.label} value={m.label}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="grid items-end gap-1 mb-2" style={{ gridTemplateColumns: `200px repeat(${columns.length}, 1fr) 80px 1fr` }}>
            <div className="text-xs text-muted-foreground font-medium">Stage</div>
            {columns.map(col => (
              <div key={col.label} className="text-xs text-muted-foreground text-center font-medium">{col.label}</div>
            ))}
            <div className="text-xs text-muted-foreground text-center font-medium">Total</div>
            <div />
          </div>

          <div className="space-y-1.5">
            {tableData.map((row, idx) => {
              const pct = (row.total / maxTotal) * 100;
              const color = CHART_PALETTE[idx % CHART_PALETTE.length];
              const sqlRate = sqlTotal > 0 ? ((row.total / sqlTotal) * 100).toFixed(1) : null;
              return (
                <div key={row.key}>
                  <div className="grid items-center gap-1" style={{ gridTemplateColumns: `200px repeat(${columns.length}, 1fr) 80px 1fr` }}>
                    <span className="text-sm font-medium text-foreground truncate">{row.label}</span>
                    {row.colValues.map((val, ci) => (
                      <span key={ci} className="text-sm text-center font-display font-bold text-foreground">{val > 0 ? val : '—'}</span>
                    ))}
                    <span className="text-sm text-center font-display font-bold text-foreground">{row.total}</span>
                    <div>
                      <div className="h-8 rounded-lg bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(pct, 3)}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                          className="h-full rounded-lg"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                      {sqlTotal > 0 && (
                        <div className="text-right mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {sqlRate}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
