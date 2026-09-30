import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Percent, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLeadMovements } from '@/hooks/useLeadMovements';
import { useRawLeads } from '@/hooks/useRawLeads';
import { useConfigStages, getSQLStages } from '@/hooks/useConfigStages';
import {
  PipelineFunnelCard,
  type TimeMode,
  getAvailableQuarters,
  getAvailableMonths,
  getAvailableYears,
  getWeeksOfMonth,
  getLastWeekRange,
  filterByDateRange,
} from '@/components/funnel/PipelineFunnelCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GHLFunnelSkeleton } from '@/components/funnel/GHLFunnelCard';

const PIPELINES = ['Aluguer', 'Compra'] as const;
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const NAO_ATENDEU_STAGE = 'Não Atendeu (Lead Qualificada)';

const SalesFunnel = () => {
  const { data: leadData, isLoading: leadLoading, isError: leadError } = useLeadMovements();
  const { data: allConfigs } = useConfigStages();
  const { data: rawLeads = [] } = useRawLeads();
  const [selectedPipeline, setSelectedPipeline] = useState<string>('Aluguer');
  const [showSQLDialog, setShowSQLDialog] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [showAtendimentoDialog, setShowAtendimentoDialog] = useState(false);
  // Lifted date state
  const [timeMode, setTimeMode] = useState<TimeMode>('quarter');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  const leadMovements = Array.isArray(leadData?.movements) ? leadData.movements : [];
  const configs = allConfigs ?? [];

  const pipelineMovements = useMemo(
    () => leadMovements.filter(m => m.pipeline === selectedPipeline),
    [leadMovements, selectedPipeline]
  );

  // Auto-init selectors when pipeline changes
  const quarters = useMemo(() => getAvailableQuarters(pipelineMovements), [pipelineMovements]);
  const months = useMemo(() => getAvailableMonths(pipelineMovements), [pipelineMovements]);
  const years = useMemo(() => getAvailableYears(pipelineMovements), [pipelineMovements]);

  useMemo(() => {
    if (quarters.length > 0 && !quarters.find(q => q.label === selectedQuarter)) setSelectedQuarter(quarters[0].label);
    if (months.length > 0 && !months.find(m => m.label === selectedMonth)) setSelectedMonth(months[0].label);
    if (years.length > 0 && !years.find(y => y.label === selectedYear)) setSelectedYear(years[0].label);
  }, [selectedPipeline, quarters, months, years]);

  // Compute total date range for KPI calculations
  const totalRange = useMemo(() => {
    if (timeMode === 'last_week') {
      const r = getLastWeekRange();
      return { start: r.start, end: r.end };
    }
    if (timeMode === 'year') {
      const y = years.find(y => y.label === selectedYear);
      if (!y) return null;
      return { start: new Date(y.year, 0, 1), end: new Date(y.year + 1, 0, 1) };
    } else if (timeMode === 'quarter') {
      const q = quarters.find(q => q.label === selectedQuarter);
      if (!q) return null;
      const startMonth = (q.quarter - 1) * 3;
      return { start: new Date(q.year, startMonth, 1), end: new Date(q.year, startMonth + 3, 1) };
    } else {
      const m = months.find(m => m.label === selectedMonth);
      if (!m) return null;
      return { start: new Date(m.year, m.month, 1), end: new Date(m.year, m.month + 1, 1) };
    }
  }, [timeMode, selectedQuarter, selectedMonth, selectedYear, quarters, months, years]);

  // SQL → Fechado rate
  const { sqls, fechados, taxa } = useMemo(() => {
    if (!totalRange) return { sqls: 0, fechados: 0, taxa: null };
    const filtered = filterByDateRange(pipelineMovements, totalRange.start, totalRange.end);
    const sqlStages = getSQLStages(selectedPipeline, configs);
    const sqlIds = new Set<string>();
    const fechadoIds = new Set<string>();
    for (const m of filtered) {
      const s = m.stage.trim();
      if (sqlStages.includes(s)) sqlIds.add(m.id);
      if (s === 'Fechado') fechadoIds.add(m.id);
    }
    const sqlCount = sqlIds.size;
    const fechadoCount = fechadoIds.size;
    return {
      sqls: sqlCount,
      fechados: fechadoCount,
      taxa: sqlCount > 0 ? ((fechadoCount / sqlCount) * 100).toFixed(1) : null,
    };
  }, [pipelineMovements, totalRange, selectedPipeline, configs]);

  // Recovery rate: leads recovered after "Não Atendeu (Lead Qualificada)"
  const { recoveryRate, recoveryNum, recoveryDen } = useMemo(() => {
    if (!totalRange) return { recoveryRate: null, recoveryNum: 0, recoveryDen: 0 };
    const filtered = filterByDateRange(pipelineMovements, totalRange.start, totalRange.end);

    // Group by lead, sorted chronologically
    const byLead = new Map<string, { stage: string; date: string }[]>();
    for (const m of filtered) {
      if (!byLead.has(m.id)) byLead.set(m.id, []);
      byLead.get(m.id)!.push({ stage: m.stage.trim(), date: m.date });
    }

    let denominator = 0;
    let numerator = 0;

    for (const [, events] of byLead) {
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (let i = 0; i < events.length; i++) {
        if (events[i].stage === NAO_ATENDEU_STAGE) {
          denominator++;
          const next = events[i + 1];
          // Só conta como recuperada se houver mesmo um movimento seguinte que não seja
          // "Perdido" — uma lead sem nenhum movimento a seguir está apenas parada/por
          // resolver, não recuperada.
          if (next && next.stage !== 'Perdido') {
            numerator++;
          }
          break; // count each lead only once
        }
      }
    }

    return {
      recoveryRate: denominator > 0 ? ((numerator / denominator) * 100).toFixed(1) : null,
      recoveryNum: numerator,
      recoveryDen: denominator,
    };
  }, [pipelineMovements, totalRange]);

  // Taxa de Aprovação: das leads que submeteram pedido de aprovação, quantas foram aprovadas.
  // A etapa "Crédito Aprovado" só existe a partir de 1 Jul 2026. Para submissões a partir daí,
  // conta-se quem atingiu "Crédito Aprovado" ou "Financiamento Emitido" (financiamento emitido
  // implica que o crédito já foi aprovado). Para submissões anteriores (sem nenhuma dessas etapas
  // disponível), usa-se como numerador o total de leads que chegaram a "Fechado" nesse período —
  // não necessariamente as mesmas leads que submeteram, mas um proxy agregado (é como o próprio
  // utilizador reconstitui esse número historicamente: nº de fechos = nº de aprovações).
  const APROVACAO_CUTOVER = new Date(2026, 6, 1); // 1 Jul 2026
  const APROVADO_ATUAL_STAGES = ['Crédito Aprovado', 'Financiamento Emitido'];
  const { aprovacaoRate, aprovacaoNum, aprovacaoDen } = useMemo(() => {
    if (!totalRange) return { aprovacaoRate: null, aprovacaoNum: 0, aprovacaoDen: 0 };
    const filtered = filterByDateRange(pipelineMovements, totalRange.start, totalRange.end);

    const byLead = new Map<string, { stages: Set<string>; submittedAt: Date | null }>();
    for (const m of filtered) {
      const stage = m.stage.trim();
      if (!byLead.has(m.id)) byLead.set(m.id, { stages: new Set(), submittedAt: null });
      const entry = byLead.get(m.id)!;
      entry.stages.add(stage);
      if (stage === 'Pré Aprovação Submetida') {
        const d = new Date(m.date);
        if (!entry.submittedAt || d < entry.submittedAt) entry.submittedAt = d;
      }
    }

    // Fechados anteriores ao corte — usados como proxy agregado de aprovações legadas,
    // desacoplado de qual lead especificamente submeteu o pedido.
    const fechadosLegacy = new Set<string>();
    for (const m of filtered) {
      if (m.stage.trim() === 'Fechado' && new Date(m.date) < APROVACAO_CUTOVER) {
        fechadosLegacy.add(m.id);
      }
    }

    let denominator = 0;
    let numeratorAtual = 0;
    for (const [, { stages, submittedAt }] of byLead) {
      if (!stages.has('Pré Aprovação Submetida') || !submittedAt) continue;
      denominator++;
      if (submittedAt >= APROVACAO_CUTOVER && APROVADO_ATUAL_STAGES.some(s => stages.has(s))) numeratorAtual++;
    }
    const numerator = numeratorAtual + fechadosLegacy.size;

    return {
      aprovacaoRate: denominator > 0 ? ((numerator / denominator) * 100).toFixed(1) : null,
      aprovacaoNum: numerator,
      aprovacaoDen: denominator,
    };
  }, [pipelineMovements, totalRange]);

  const [showAprovacaoDialog, setShowAprovacaoDialog] = useState(false);

  // Tempo de Atendimento: tempo entre a lead entrar na base de dados (dataRegisto, RAW_LEADS) e o
  // primeiro movimento a seguir a "Nova Lead Qualificada" no CRM. Leads sem movimento a seguir a
  // essa etapa ficam de fora do cálculo (ainda não há sinal de atendimento para elas).
  const NOVA_LEAD_QUALIFICADA = 'Nova Lead Qualificada';
  const { tempoAtendimentoMedioHoras, tempoAtendimentoCount } = useMemo(() => {
    if (!totalRange) return { tempoAtendimentoMedioHoras: null as number | null, tempoAtendimentoCount: 0 };

    const registoPorNome = new Map<string, Date>();
    rawLeads.forEach(l => {
      if (!l.nome || !l.dataRegisto) return;
      const v = (l.oferta || '').toLowerCase();
      const matches = selectedPipeline === 'Aluguer' ? v.includes('aluguer') : (v.includes('compra') || v.includes('venda'));
      if (!matches) return;
      const d = new Date(l.dataRegisto);
      const existing = registoPorNome.get(l.nome);
      if (!existing || d < existing) registoPorNome.set(l.nome, d);
    });

    const byLeadName = new Map<string, { stage: string; date: string }[]>();
    pipelineMovements.forEach(m => {
      if (!m.date) return;
      if (!byLeadName.has(m.nome)) byLeadName.set(m.nome, []);
      byLeadName.get(m.nome)!.push({ stage: m.stage.trim(), date: m.date });
    });

    const duracoesHoras: number[] = [];
    for (const [nome, dataRegisto] of registoPorNome) {
      if (!(dataRegisto >= totalRange.start && dataRegisto < totalRange.end)) continue;
      const events = byLeadName.get(nome);
      if (!events) continue;
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const idx = events.findIndex(e => e.stage === NOVA_LEAD_QUALIFICADA);
      if (idx === -1) continue;
      const next = events[idx + 1];
      if (!next) continue;
      const diffHoras = (new Date(next.date).getTime() - dataRegisto.getTime()) / (1000 * 60 * 60);
      if (diffHoras >= 0) duracoesHoras.push(diffHoras);
    }

    if (duracoesHoras.length === 0) return { tempoAtendimentoMedioHoras: null, tempoAtendimentoCount: 0 };
    const media = duracoesHoras.reduce((s, v) => s + v, 0) / duracoesHoras.length;
    return { tempoAtendimentoMedioHoras: media, tempoAtendimentoCount: duracoesHoras.length };
  }, [rawLeads, pipelineMovements, totalRange, selectedPipeline]);

  const formatDuracao = (horas: number | null): string => {
    if (horas === null) return '—';
    if (horas < 24) return `${horas.toFixed(1)}h`;
    return `${(horas / 24).toFixed(1)}d`;
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-display font-bold text-foreground">
          Funil de <span className="text-gradient-primary">Vendas</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline completo baseado nos movimentos de leads
        </p>
      </motion.div>

      <div className="mb-4">
        <Tabs value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <TabsList>
            {PIPELINES.map(p => (
              <TabsTrigger key={p} value={p}>{p}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedPipeline === 'Compra' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-6`}>
        <KPICard
          title="Taxa SQL → Fechado"
          value={taxa !== null ? `${taxa}%` : '—'}
          icon={<Percent className="h-4 w-4" />}
          tooltip="Percentagem de leads SQL que passaram a Fechado"
          onClick={() => setShowSQLDialog(true)}
          delay={0.1}
        />
        <KPICard
          title="Taxa de Recuperação"
          value={recoveryRate !== null ? `${recoveryRate}%` : '—'}
          icon={<RefreshCw className="h-4 w-4" />}
          tooltip="Leads recuperadas após 'Não Atendeu'"
          onClick={() => setShowRecoveryDialog(true)}
          delay={0.2}
        />
        <KPICard
          title="Tempo de Atendimento"
          value={formatDuracao(tempoAtendimentoMedioHoras)}
          icon={<Clock className="h-4 w-4" />}
          tooltip="Tempo médio entre a lead entrar na base de dados e o primeiro movimento a seguir a 'Nova Lead Qualificada'"
          onClick={() => setShowAtendimentoDialog(true)}
          delay={0.3}
        />
        {selectedPipeline === 'Compra' && (
          <KPICard
            title="Taxa de Aprovação"
            value={aprovacaoRate !== null ? `${aprovacaoRate}%` : '—'}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tooltip="Pedidos de aprovação de crédito submetidos que foram aprovados"
            onClick={() => setShowAprovacaoDialog(true)}
            delay={0.4}
          />
        )}
      </div>

      <Dialog open={showSQLDialog} onOpenChange={setShowSQLDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Taxa SQL → Fechado</DialogTitle>
            <DialogDescription>Detalhes do cálculo para o período e pipeline selecionados</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Fórmula</p>
              <p className="text-sm font-mono">Leads Fechadas ÷ Leads SQL × 100</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">SQLs</p>
                <p className="text-xl font-bold text-foreground">{sqls}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Fechados</p>
                <p className="text-xl font-bold text-foreground">{fechados}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground">Taxa</p>
                <p className="text-xl font-bold text-primary">{taxa !== null ? `${taxa}%` : '—'}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Taxa de Recuperação</DialogTitle>
            <DialogDescription>Detalhes do cálculo para o período e pipeline selecionados</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Fórmula</p>
              <p className="text-sm font-mono">Leads Recuperadas ÷ Leads "Não Atendeu" × 100</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Conta como recuperada qualquer lead que teve um evento seguinte a "Não Atendeu (Lead Qualificada)" e esse evento não é "Perdido". Leads sem nenhum evento a seguir (ainda por resolver) contam como não recuperadas.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Não Atendeu</p>
                <p className="text-xl font-bold text-foreground">{recoveryDen}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Recuperadas</p>
                <p className="text-xl font-bold text-foreground">{recoveryNum}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground">Taxa</p>
                <p className="text-xl font-bold text-primary">{recoveryRate !== null ? `${recoveryRate}%` : '—'}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAprovacaoDialog} onOpenChange={setShowAprovacaoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Taxa de Aprovação</DialogTitle>
            <DialogDescription>Detalhes do cálculo para o período e pipeline selecionados</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Fórmula</p>
              <p className="text-sm font-mono">Pedidos Aprovados ÷ Pedidos Submetidos × 100</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Conta como submetido qualquer lead que passou por "Pré Aprovação Submetida". Para submissões a partir de 1 Jul 2026, conta como aprovado se atingiu "Crédito Aprovado" ou "Financiamento Emitido". Para submissões anteriores (antes dessas etapas existirem), usa-se o nº total de leads que chegaram a "Fechado" nesse período como proxy de aprovações.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Submetidos</p>
                <p className="text-xl font-bold text-foreground">{aprovacaoDen}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Aprovados</p>
                <p className="text-xl font-bold text-foreground">{aprovacaoNum}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground">Taxa</p>
                <p className="text-xl font-bold text-primary">{aprovacaoRate !== null ? `${aprovacaoRate}%` : '—'}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAtendimentoDialog} onOpenChange={setShowAtendimentoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tempo de Atendimento</DialogTitle>
            <DialogDescription>Detalhes do cálculo para o período e pipeline selecionados</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Fórmula</p>
              <p className="text-sm font-mono">Média (1º movimento após "Nova Lead Qualificada" − Data de Registo)</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo entre a lead entrar na base de dados e o primeiro movimento a seguir a "Nova Lead Qualificada" no CRM. Leads sem nenhum movimento a seguir a essa etapa ficam de fora do cálculo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Leads consideradas</p>
                <p className="text-xl font-bold text-foreground">{tempoAtendimentoCount}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground">Tempo médio</p>
                <p className="text-xl font-bold text-primary">{formatDuracao(tempoAtendimentoMedioHoras)}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {leadLoading && <GHLFunnelSkeleton />}

      {leadError && (
        <Card className="glass-card border-border/50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">Erro ao carregar dados de leads</p>
          </CardContent>
        </Card>
      )}

      {leadMovements.length > 0 && (
        <PipelineFunnelCard
          movements={leadMovements}
          pipelineName={selectedPipeline}
          timeMode={timeMode}
          onTimeModeChange={setTimeMode}
          selectedQuarter={selectedQuarter}
          onSelectedQuarterChange={setSelectedQuarter}
          selectedMonth={selectedMonth}
          onSelectedMonthChange={setSelectedMonth}
          selectedYear={selectedYear}
          onSelectedYearChange={setSelectedYear}
        />
      )}
    </DashboardLayout>
  );
};

export default SalesFunnel;
