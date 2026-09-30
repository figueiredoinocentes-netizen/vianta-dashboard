import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useMonthlyObjectives } from '@/hooks/useMonthlyObjectives';
import { useSheetData } from '@/hooks/useSheetData';
import { useRawLeads } from '@/hooks/useRawLeads';
import { useLeadMovements } from '@/hooks/useLeadMovements';
import { useConfigStages, getMQLStages, getSQLStages } from '@/hooks/useConfigStages';
import { useActionItems, type ActionItem, type ActionItemStatus, type ActionItemPriority } from '@/hooks/useActionItems';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Save, ArrowDown, Info, Plus, Trash2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import type { FilterState, OfferType } from '@/types/dashboard';

function monthKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function monthLabel(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: pt });
}

const NOW = new Date();
const BASE_MONTH = startOfMonth(NOW);

interface TabContentProps {
  oferta: 'aluguer' | 'compra';
  mes: string;
}

function PlanTab({ oferta, mes }: TabContentProps) {
  const { getObjective, upsertObjective } = useMonthlyObjectives();

  // Sheet data for previous calendar month averages
  const mesPassadoRange = useMemo(() => {
    const from = startOfMonth(subMonths(new Date(), 1));
    const to = endOfMonth(subMonths(new Date(), 1));
    return { from, to };
  }, []);

  const sheetFiltersMesPassado: FilterState = useMemo(() => ({
    period: 'custom',
    offerTypes: [oferta as OfferType],
    source: 'todos',
    customDateFrom: mesPassadoRange.from.toISOString(),
    customDateTo: mesPassadoRange.to.toISOString(),
  }), [oferta, mesPassadoRange]);

  const sheetFiltersAll: FilterState = useMemo(() => ({
    period: 'all',
    offerTypes: [oferta as OfferType],
    source: 'todos',
  }), [oferta]);

  const { data: sheetMesPassado } = useSheetData(sheetFiltersMesPassado);
  const { data: sheetAll } = useSheetData(sheetFiltersAll);
  const { data: leads = [] } = useRawLeads();
  const { data: movementsData } = useLeadMovements();
  const { data: configs = [] } = useConfigStages();

  const existing = getObjective(oferta, mes);

  // --- Base activa (Aluguer only) ---
  const baseMetrics = useMemo(() => {
    if (oferta !== 'aluguer' || !sheetAll) return null;
    const activeDrivers = sheetAll.drivers.filter(d => !d.dataSaida && d.tipoOferta === 'aluguer');
    const clientesAtivos = activeDrivers.length;
    const churnHist = sheetMesPassado?.churnBreakdown?.taxaChurn ?? 0;
    const ticketMedio = sheetMesPassado?.kpis?.ticketMedio ?? 0;
    // For aluguer, ticket in sheet is weekly → monthly = ×4
    const ticketMensal = ticketMedio * 4;
    const saidasEsperadas = Math.round(clientesAtivos * (churnHist / 100));
    const revenueRisco = saidasEsperadas * ticketMensal;
    const revenueBase = clientesAtivos * ticketMensal;
    return { clientesAtivos, churnHist, saidasEsperadas, revenueRisco, revenueBase, ticketMensal };
  }, [oferta, sheetAll, sheetMesPassado]);

  // --- Simulator defaults (previous calendar month) ---
  const defaults = useMemo(() => {
    const ticketMedio = sheetMesPassado?.kpis?.ticketMedio ?? 0;
    const ticketMensal = oferta === 'aluguer' ? ticketMedio * 4 : ticketMedio;

    const movements = movementsData?.movements ?? [];
    const from = startOfDay(mesPassadoRange.from);
    const to = endOfDay(mesPassadoRange.to);

    const pipelines = [...new Set(configs.filter(c => c.pipeline_name.toLowerCase().includes(oferta)).map(c => c.pipeline_name))];
    const periodMovements = movements.filter(m => {
      if (!m.date) return false;
      const d = new Date(m.date);
      return d >= from && d <= to && pipelines.some(p => m.pipeline.toLowerCase() === p.toLowerCase());
    });

    const sqlStages = pipelines.flatMap(p => getSQLStages(p, configs));
    const sqlLeads = new Set<string>();
    const fechoLeads = new Set<string>();
    const preAprovacaoLeads = new Set<string>();
    periodMovements.forEach(m => {
      if (sqlStages.includes(m.stage)) sqlLeads.add(m.nome);
      if (m.stage === 'Fechado') fechoLeads.add(m.nome);
      if (m.stage === 'Pré Aprovação Submetida') preAprovacaoLeads.add(m.nome);
    });

    const sqls = sqlLeads.size;
    const fechos = fechoLeads.size;
    const preAprovacao = preAprovacaoLeads.size;

    // Leads from rawLeads (mês passado, same oferta)
    const filteredLeads = leads.filter(l => {
      if (l.oferta?.toLowerCase() !== oferta) return false;
      if (!l.dataRegisto) return false;
      const d = parseISO(l.dataRegisto);
      return d >= from && d <= to;
    });
    const totalLeads = filteredLeads.length;

    const taxaSqlFecho = fechos > 0 ? (fechos / sqls) * 100 : 0;
    const taxaLeadSql = totalLeads > 0 ? (sqls / totalLeads) * 100 : 0;
    const investimento = sheetMesPassado?.kpis?.investimentoTotal ?? 0;
    const cpl = totalLeads > 0 ? investimento / totalLeads : 0;

    return { ticketMensal, taxaSqlFecho, taxaLeadSql, cpl, preAprovacao };
  }, [sheetMesPassado, movementsData, configs, leads, oferta, mesPassadoRange]);

  // --- State ---
  const [revenueAlvo, setRevenueAlvo] = useState<number>(existing?.revenueAlvo ?? 0);
  const [vendasAlvo, setVendasAlvo] = useState<number>(existing?.fechosAlvo ?? 0);
  const [ticketMedio, setTicketMedio] = useState<number>(defaults.ticketMensal);
  const [taxaSqlFecho, setTaxaSqlFecho] = useState<number>(defaults.taxaSqlFecho);
  const [taxaLeadSql, setTaxaLeadSql] = useState<number>(defaults.taxaLeadSql);
  const [cpl, setCpl] = useState<number>(defaults.cpl);
  const [preAprovacaoAlvo, setPreAprovacaoAlvo] = useState<number>(existing?.preAprovacaoAlvo ?? 0);

  // Sync defaults when they load
  useEffect(() => {
    if (defaults.ticketMensal > 0) setTicketMedio(defaults.ticketMensal);
    if (defaults.taxaSqlFecho > 0) setTaxaSqlFecho(defaults.taxaSqlFecho);
    if (defaults.taxaLeadSql > 0) setTaxaLeadSql(defaults.taxaLeadSql);
    if (defaults.cpl > 0) setCpl(defaults.cpl);
  }, [defaults]);

  useEffect(() => {
    if (existing) {
      setRevenueAlvo(existing.revenueAlvo);
      setVendasAlvo(existing.fechosAlvo);
      setPreAprovacaoAlvo(existing.preAprovacaoAlvo ?? 0);
    }
  }, [existing]);

  // --- Decomposition ---
  // Compra: o alvo é diretamente um nº de vendas (fechos); o revenue é derivado disso.
  // Aluguer: o alvo continua a ser revenue (por causa da base recorrente/churn).
  const revenueNovos = oferta === 'aluguer' && baseMetrics
    ? Math.max(0, revenueAlvo - (baseMetrics.revenueBase - baseMetrics.revenueRisco))
    : oferta === 'compra'
      ? vendasAlvo * ticketMedio
      : revenueAlvo;

  const fechosNecessarios = oferta === 'compra'
    ? vendasAlvo
    : (ticketMedio > 0 ? Math.ceil(revenueNovos / ticketMedio) : 0);
  const sqlsNecessarios = taxaSqlFecho > 0 ? Math.ceil(fechosNecessarios / (taxaSqlFecho / 100)) : 0;
  const leadsNecessarias = taxaLeadSql > 0 ? Math.ceil(sqlsNecessarios / (taxaLeadSql / 100)) : 0;
  const budgetEstimado = leadsNecessarias * cpl;

  const handleSave = async () => {
    try {
      await upsertObjective.mutateAsync({
        mes,
        oferta,
        revenueAlvo: oferta === 'compra' ? revenueNovos : revenueAlvo,
        fechosAlvo: fechosNecessarios,
        sqlsAlvo: sqlsNecessarios,
        leadsAlvo: leadsNecessarias,
        budgetAlvo: budgetEstimado,
        preAprovacaoAlvo: oferta === 'compra' ? preAprovacaoAlvo : 0,
      });
      toast.success('Objectivos guardados com sucesso');
    } catch {
      toast.error('Erro ao guardar objectivos');
    }
  };

  const fmt = (v: number) => `€${v.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Section 1: Base activa (only Aluguer) */}
      {oferta === 'aluguer' && baseMetrics && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Base activa e churn
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Clientes activos sem data de saída. Churn e saídas baseados no mês passado.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricBox label="Clientes activos" value={String(baseMetrics.clientesAtivos)} />
              <MetricBox label="Churn histórico (mês passado)" value={fmtPct(baseMetrics.churnHist)} />
              <MetricBox label="Saídas esperadas" value={String(baseMetrics.saidasEsperadas)} />
              <MetricBox label="Revenue em risco" value={fmt(baseMetrics.revenueRisco)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 2: Objectivo (revenue para Aluguer, vendas para Compra) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {oferta === 'compra' ? 'Objectivo de vendas' : 'Objectivo de revenue'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {oferta === 'compra' ? (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Vendas alvo (unidades)</label>
              <Input
                type="number"
                value={vendasAlvo || ''}
                onChange={e => setVendasAlvo(Number(e.target.value) || 0)}
                className="max-w-[200px]"
                placeholder="0"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Revenue alvo (€)</label>
              <Input
                type="number"
                value={revenueAlvo || ''}
                onChange={e => setRevenueAlvo(Number(e.target.value) || 0)}
                className="max-w-[200px]"
                placeholder="0"
              />
            </div>
          )}
          {oferta === 'aluguer' && baseMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <MetricBox label="Revenue base recorrente" value={fmt(baseMetrics.revenueBase)} sub={`${baseMetrics.clientesAtivos} × ${fmt(baseMetrics.ticketMensal)}`} />
              <MetricBox label="Revenue em risco" value={fmt(baseMetrics.revenueRisco)} sub={`${baseMetrics.saidasEsperadas} × ${fmt(baseMetrics.ticketMensal)}`} />
              <MetricBox label="Revenue de novos fechos" value={fmt(revenueNovos)} sub={`${fmt(revenueAlvo)} − (${fmt(baseMetrics.revenueBase)} − ${fmt(baseMetrics.revenueRisco)})`} highlight />
            </div>
          )}
          {oferta === 'compra' && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4 pt-2">
              <MetricBox label="Revenue estimado" value={fmt(revenueNovos)} sub={`${vendasAlvo} × ${fmt(ticketMedio)}`} highlight />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2b: Objectivo de pré-aprovações (Compra only) */}
      {oferta === 'compra' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Objectivo de pré-aprovações
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Nº de pedidos de aprovação de crédito submetidos ("Pré Aprovação Submetida"). Mês passado: {defaults.preAprovacao}.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Pré aprovações alvo (unidades)</label>
              <Input
                type="number"
                value={preAprovacaoAlvo || ''}
                onChange={e => setPreAprovacaoAlvo(Number(e.target.value) || 0)}
                className="max-w-[200px]"
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">Mês passado: {defaults.preAprovacao}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Simulador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Simulador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SimInput label="Ticket médio (€)" value={ticketMedio} onChange={setTicketMedio} />
            <SimInput label="Taxa SQL → Fecho (%)" value={taxaSqlFecho} onChange={setTaxaSqlFecho} step={0.1} />
            <SimInput label="Taxa Lead → SQL (%)" value={taxaLeadSql} onChange={setTaxaLeadSql} step={0.1} />
            <SimInput label="CPL — Custo por Lead (€)" value={cpl} onChange={setCpl} />
          </div>
          <p className="text-xs text-muted-foreground italic">
            Valores pré-preenchidos com médias do mês passado. Altera para simular cenários diferentes.
          </p>
        </CardContent>
      </Card>

      {/* Section 4: Decomposição */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Decomposição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1">
            {oferta === 'compra' ? (
              <DecompStep
                label="Fechos necessários (vendas alvo)"
                value={String(fechosNecessarios)}
                formula={null}
              />
            ) : (
              <>
                <DecompStep
                  label="Revenue de novos fechos"
                  value={fmt(revenueNovos)}
                  formula={null}
                />
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
                <DecompStep
                  label="Fechos necessários"
                  value={String(fechosNecessarios)}
                  formula={`${fmt(revenueNovos)} ÷ ${fmt(ticketMedio)}`}
                />
              </>
            )}
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
            <DecompStep
              label="SQLs necessários"
              value={String(sqlsNecessarios)}
              formula={`${fechosNecessarios} ÷ ${fmtPct(taxaSqlFecho)}`}
            />
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
            <DecompStep
              label="Leads necessárias"
              value={String(leadsNecessarias)}
              formula={`${sqlsNecessarios} ÷ ${fmtPct(taxaLeadSql)}`}
            />
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
            <DecompStep
              label="Budget estimado"
              value={fmt(budgetEstimado)}
              formula={`${leadsNecessarias} × ${fmt(cpl)}`}
              highlight
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsertObjective.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {upsertObjective.isPending ? 'A guardar...' : 'Guardar objectivos'}
        </Button>
      </div>
    </div>
  );
}

function MetricBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SimInput({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        value={value || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        step={step}
      />
    </div>
  );
}

function DecompStep({ label, value, formula, highlight }: { label: string; value: string; formula: string | null; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-6 py-3 text-center w-full max-w-md ${highlight ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {formula && <p className="text-[10px] text-muted-foreground">{formula}</p>}
    </div>
  );
}

const STATUS_COLUMNS: { key: ActionItemStatus; label: string }[] = [
  { key: 'todo', label: 'Por Fazer' },
  { key: 'em_curso', label: 'Em Curso' },
  { key: 'feito', label: 'Feito' },
];

const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

function priorityBadge(priority: ActionItemPriority | null) {
  switch (priority) {
    case 'alta':
      return <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 border-rose-500/30">Alta</Badge>;
    case 'media':
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Média</Badge>;
    case 'baixa':
      return <Badge variant="outline" className="text-muted-foreground">Baixa</Badge>;
    default:
      return null;
  }
}

function NewActionItemDialog({ onCreate, isPending }: { onCreate: (item: { title: string; description?: string; category?: string; priority?: ActionItemPriority }) => Promise<void>; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<ActionItemPriority | ''>('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setPriority('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('O título é obrigatório');
      return;
    }
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        priority: priority || undefined,
      });
      toast.success('Item adicionado ao backlog');
      reset();
      setOpen(false);
    } catch {
      toast.error('Erro ao adicionar item');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo item de backlog</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Título *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do item" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes (opcional)" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Ads, CRM..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prioridade</label>
              <Select value={priority} onValueChange={v => setPriority(v as ActionItemPriority)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'A adicionar...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionItemRow({ item, onStatusChange, onDelete }: { item: ActionItem; onStatusChange: (id: string, status: ActionItemStatus) => void; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover item?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação vai remover "{item.title}" do backlog. Não é possível desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(item.id)}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {item.description && (
        <p className="text-xs text-muted-foreground">{item.description}</p>
      )}
      <div className="flex items-center flex-wrap gap-2">
        {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
        {priorityBadge(item.priority)}
      </div>
      <Select value={item.status} onValueChange={v => onStatusChange(item.id, v as ActionItemStatus)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todo">Por Fazer</SelectItem>
          <SelectItem value="em_curso">Em Curso</SelectItem>
          <SelectItem value="feito">Feito</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ActionItemsBacklog() {
  const { data, isLoading, createItem, updateItem, deleteItem } = useActionItems();

  const grouped = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 3;
      const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return STATUS_COLUMNS.reduce<Record<ActionItemStatus, ActionItem[]>>((acc, col) => {
      acc[col.key] = sorted.filter(i => i.status === col.key);
      return acc;
    }, { todo: [], em_curso: [], feito: [] });
  }, [data]);

  const handleStatusChange = (id: string, status: ActionItemStatus) => {
    updateItem.mutate({ id, status }, {
      onError: () => toast.error('Erro ao atualizar estado'),
    });
  };

  const handleDelete = (id: string) => {
    deleteItem.mutate(id, {
      onSuccess: () => toast.success('Item removido'),
      onError: () => toast.error('Erro ao remover item'),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Backlog de Ações</CardTitle>
        <NewActionItemDialog
          onCreate={async (item) => { await createItem.mutateAsync(item); }}
          isPending={createItem.isPending}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ainda não há itens no backlog. Adiciona o primeiro.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUS_COLUMNS.map(col => (
              <div key={col.key} className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {col.label} ({grouped[col.key].length})
                </p>
                <div className="space-y-2">
                  {grouped[col.key].length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem itens</p>
                  ) : (
                    grouped[col.key].map(item => (
                      <ActionItemRow key={item.id} item={item} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Planeamento = () => {
  const [monthOffset, setMonthOffset] = useState(0);
  const selectedMonth = addMonths(BASE_MONTH, monthOffset);
  const mes = format(selectedMonth, 'yyyy-MM-dd');

  const { isLoading } = useMonthlyObjectives();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Planeamento</h1>
            <p className="text-sm text-muted-foreground mt-1">Define objectivos mensais por oferta</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonthOffset(o => Math.max(o - 1, -6))} disabled={monthOffset <= -6}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">
              {monthLabel(selectedMonth)}
            </span>
            <Button variant="outline" size="icon" onClick={() => setMonthOffset(o => Math.min(o + 1, 3))} disabled={monthOffset >= 3}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="aluguer">
          <TabsList>
            <TabsTrigger value="aluguer">Aluguer</TabsTrigger>
            <TabsTrigger value="compra">Compra</TabsTrigger>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <TabsTrigger value="slot" disabled className="opacity-50 cursor-not-allowed">
                    Slot
                  </TabsTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent>Sem investimento activo</TooltipContent>
            </Tooltip>
          </TabsList>
          <TabsContent value="aluguer">
            <PlanTab oferta="aluguer" mes={mes} />
          </TabsContent>
          <TabsContent value="compra">
            <PlanTab oferta="compra" mes={mes} />
          </TabsContent>
        </Tabs>

        <ActionItemsBacklog />
      </div>
    </DashboardLayout>
  );
};

export default Planeamento;
