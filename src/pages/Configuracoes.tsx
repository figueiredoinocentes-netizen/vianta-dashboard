import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, AlertTriangle, Tag } from 'lucide-react';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { useConfigStages, getMQLStages, getSQLStages, getContactadosConfig } from '@/hooks/useConfigStages';
import { useSourceMapping } from '@/hooks/useSourceMapping';
import { useMetaCreativeNames } from '@/hooks/useMetaCreativeNames';
import { useFunnelVisualConfig } from '@/hooks/useFunnelVisualConfig';
import { useGHLData } from '@/hooks/useGHLData';
import { useRawLeads } from '@/hooks/useRawLeads';
import { useLeadMovements } from '@/hooks/useLeadMovements';
import { PipelineStageEditor } from '@/components/funnel/PipelineStageEditor';
import { AliasMapper } from '@/components/funnel/AliasMapper';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PipelineStageConfig, SourceMapping } from '@/types/dashboard';
import SalesPlaybooksSection from '@/components/configuracoes/SalesPlaybooksSection';

const PIPELINES = ['Aluguer', 'Compra', 'Slot'];

// ─── Tab 1: Regras de qualificação ───

function QualificationRulesTab() {
  const { data: allConfigs } = useConfigStages();
  const { config: visualConfig } = useFunnelVisualConfig();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editPipeline, setEditPipeline] = useState('');
  const { data: editStages } = usePipelineStages(editPipeline || PIPELINES[0]);

  // Stages available to select in the rules editor = current visual funnel stages
  // for the pipeline being edited (the visual funnel is the canonical source of truth).
  const visualStageNames = useMemo(() => {
    if (!editPipeline) return [];
    return visualConfig
      .filter(v => v.pipeline.toLowerCase() === editPipeline.toLowerCase())
      .sort((a, b) => a.ordem - b.ordem)
      .map(v => v.stage);
  }, [visualConfig, editPipeline]);

  // For each visual stage of the pipeline being edited, the aliases attached to it.
  // Used inside the editor to show users which historical names will also count.
  const aliasesByStage = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!editPipeline) return map;
    for (const v of visualConfig) {
      if (v.pipeline.toLowerCase() === editPipeline.toLowerCase()) {
        map[v.stage] = v.aliases ?? [];
      }
    }
    return map;
  }, [visualConfig, editPipeline]);

  const configs = allConfigs ?? [];

  const openEditor = (pipeline: string) => {
    setEditPipeline(pipeline);
    setEditorOpen(true);
  };

  /** Render a badge for a list of stages, with an inline "+N aliases" chip if any. */
  const renderRuleBadge = (
    pipeline: string,
    stages: string[],
    label: string,
    colorClasses: string,
    suffix?: string,
  ) => {
    const allAliases = stages.flatMap(s => {
      const v = visualConfig.find(x => x.pipeline.toLowerCase() === pipeline.toLowerCase() && x.stage === s);
      return v?.aliases ?? [];
    });
    return (
      <button onClick={() => openEditor(pipeline)} className="text-left">
        <Badge className={`${colorClasses} cursor-pointer px-3 py-1.5 gap-2`}>
          <span>
            {label}: {stages.length > 0 ? stages.join(', ') : 'Não configurado'}
            {suffix ?? ''}
          </span>
          {allAliases.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-background/40 border border-current/30"
              title={`Aliases incluídos: ${allAliases.join(', ')}`}
            >
              +{allAliases.length} alias{allAliases.length > 1 ? 'es' : ''}
            </span>
          )}
        </Badge>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-secondary/30 border border-border/50 rounded-md px-3 py-2">
        Define que etapas do <strong>funil visual</strong> contam como <strong>MQL</strong>, <strong>Contactados</strong> ou <strong>SQL</strong> nos KPIs do dashboard. Os <strong>aliases</strong> definidos em cada etapa são incluídos automaticamente — basta escolher a etapa atual.
      </div>
      {PIPELINES.map(pipeline => {
        const mql = getMQLStages(pipeline, configs);
        const sql = getSQLStages(pipeline, configs);
        const contactados = getContactadosConfig(pipeline, configs);

        return (
          <Card key={pipeline} className="glass-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{pipeline}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {renderRuleBadge(pipeline, mql, 'MQL', 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30')}
                {renderRuleBadge(
                  pipeline,
                  contactados.stages,
                  'Contactados',
                  'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30',
                  contactados.prefixoExcluir ? ` (excluir: ${contactados.prefixoExcluir})` : '',
                )}
                {renderRuleBadge(pipeline, sql, 'SQL', 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30')}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <PipelineStageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pipelineName={editPipeline}
        stages={editStages ?? []}
        ghlStageNames={visualStageNames}
        aliasesByStage={aliasesByStage}
      />
    </div>
  );
}

// ─── Tab 2: Funil visual ───

function FunnelVisualTab() {
  const { config, updateOrder, toggleVisibility } = useFunnelVisualConfig();
  const { data: ghlData } = useGHLData();
  const { data: allConfigs } = useConfigStages();
  const { data: movementsData } = useLeadMovements();
  const [editPipeline, setEditPipeline] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<{ id: string; stage: string; ordem: number; visivel: boolean; aliases: string[] }[]>([]);
  const [expandedAliasIdx, setExpandedAliasIdx] = useState<number | null>(null);

  // All stage names that exist in RAW_EVENTS history per pipeline
  const historicalStagesByPipeline = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const m of movementsData?.movements ?? []) {
      if (!map[m.pipeline]) map[m.pipeline] = new Set();
      map[m.pipeline].add(m.stage.trim());
    }
    return map;
  }, [movementsData]);

  // Orphan stages in the current edit pipeline = historical stages NOT used as item.stage and NOT in any item.aliases
  const orphanStages = useMemo(() => {
    if (!editPipeline || editItems.length === 0) return [];
    const historical = historicalStagesByPipeline[editPipeline] ?? new Set<string>();
    const usedAsName = new Set(editItems.map(i => i.stage));
    const usedAsAlias = new Set<string>();
    for (const i of editItems) for (const a of i.aliases) usedAsAlias.add(a);
    return [...historical].filter(s => !usedAsName.has(s) && !usedAsAlias.has(s));
  }, [editPipeline, historicalStagesByPipeline, editItems]);

  // (KPI cross-reference removed: KPIs now read aliases automatically from this funnel.)

  const grouped = useMemo(() => {
    const map: Record<string, typeof config> = {};
    for (const c of config) {
      if (!map[c.pipeline]) map[c.pipeline] = [];
      map[c.pipeline].push(c);
    }
    return map;
  }, [config]);

  // Get GHL stage names for a pipeline
  const getGHLStages = (pipeline: string): string[] => {
    if (!ghlData?.pipelines) return [];
    const match = ghlData.pipelines.find(p => p.name.toLowerCase().includes(pipeline.toLowerCase()));
    return match?.stages.map(s => s.name) ?? [];
  };

  // KPI labels configured in pipeline_stage_configs (MQL/SQL/Contactados/...).
  // These are NEVER aliases — they are KPI rules built on top of stages.
  const kpiLabelSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of allConfigs ?? []) {
      if (c.stage_label) set.add(c.stage_label.trim());
    }
    // Common KPI keywords as a safety net
    ['MQL', 'SQL', 'Fecho', 'Fechos', 'Contactados', 'Contactos Feitos Atendidos'].forEach(k => set.add(k));
    return set;
  }, [allConfigs]);

  const buildEditorItems = (pipeline: string) => {
    const ghlStages = getGHLStages(pipeline);
    const visualItems = grouped[pipeline] ?? [];

    // Valid names = CRM (GHL) stages only. KPI labels (MQL/SQL/Fecho) are NOT stages —
    // they are configured separately in "Regras de Qualificação" and consume aliases automatically.
    const ghlSet = new Set(ghlStages);
    const validNames = ghlSet;

    // Sanitize aliases coming from DB (legacy data may contain KPI labels or names of
    // OTHER current stages — both are invalid and must be discarded).
    const sanitizeAliases = (selfStage: string, aliases: string[] | undefined): string[] => {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const raw of aliases ?? []) {
        const a = (raw ?? '').trim();
        if (!a) continue;
        if (a === selfStage) continue;
        if (kpiLabelSet.has(a)) continue;          // never allow KPI labels
        if (ghlSet.has(a)) continue;                // never allow names of other current stages
        if (seen.has(a)) continue;
        seen.add(a);
        out.push(a);
      }
      return out;
    };

    // Separate visual items into valid and orphans
    const sorted = [...visualItems].sort((a, b) => a.ordem - b.ordem);
    const orphans: typeof visualItems = [];
    const validItems: typeof visualItems = [];
    for (const v of sorted) {
      if (validNames.has(v.stage)) {
        validItems.push({ ...v, aliases: sanitizeAliases(v.stage, v.aliases) });
      } else {
        orphans.push(v);
      }
    }

    // Absorb orphan visual items (legacy stages no longer in CRM) as aliases of the nearest
    // valid stage by ordem. Skip if the orphan name is a KPI label.
    for (const orphan of orphans) {
      if (validItems.length === 0) continue;
      if (kpiLabelSet.has(orphan.stage)) continue;
      let best = validItems[0];
      let bestDist = Math.abs(orphan.ordem - best.ordem);
      for (const v of validItems) {
        const d = Math.abs(orphan.ordem - v.ordem);
        if (d < bestDist) { best = v; bestDist = d; }
      }
      const candidate = [...(best.aliases ?? []), orphan.stage, ...(orphan.aliases ?? [])];
      (best as any).aliases = sanitizeAliases(best.stage, candidate);
    }

    // Build items from valid visual items, deduplicating
    const items: typeof editItems = [];
    const seenStages = new Set<string>();

    for (const v of validItems) {
      if (seenStages.has(v.stage)) continue;
      seenStages.add(v.stage);
      items.push({ id: v.id, stage: v.stage, ordem: v.ordem, visivel: v.visivel, aliases: v.aliases ?? [] });
    }

    // Add GHL stages not yet in items
    for (const stageName of ghlStages) {
      if (!seenStages.has(stageName)) {
        items.push({ id: '', stage: stageName, ordem: items.length, visivel: true, aliases: [] });
        seenStages.add(stageName);
      }
    }

    // Re-number ordem
    return items.map((item, i) => ({ ...item, ordem: i }));
  };

  const openEditor = (pipeline: string) => {
    setExpandedAliasIdx(null);
    setEditPipeline(pipeline);
  };

  useEffect(() => {
    if (!editPipeline) {
      setEditItems([]);
      return;
    }

    setEditItems(buildEditorItems(editPipeline));
  }, [editPipeline, grouped, ghlData, kpiLabelSet]);

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= editItems.length) return;
    setEditItems(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((item, i) => ({ ...item, ordem: i }));
    });
  };

  const toggleItem = (idx: number) => {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, visivel: !item.visivel } : item));
  };

  const updateItemAliases = (idx: number, aliases: string[]) => {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, aliases } : item));
  };

  const handleSave = async () => {
    if (!editPipeline) return;
    // Safety: never persist an empty editor — prevents accidentally wiping the
    // pipeline if the dialog opened before GHL stages finished loading.
    if (editItems.length === 0) {
      toast.error('Sem etapas para guardar — espera o CRM carregar e tenta de novo.');
      return;
    }
    try {
      // 1. Fetch all existing IDs for this pipeline
      const { data: existing } = await supabase
        .from('funnel_visual_config')
        .select('id')
        .eq('pipeline', editPipeline);
      const existingIds = new Set((existing ?? []).map(r => r.id));
      const keepIds = new Set(editItems.filter(i => i.id).map(i => i.id));

      // 2. Delete orphaned rows
      const toDelete = [...existingIds].filter(id => !keepIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('funnel_visual_config')
          .delete()
          .in('id', toDelete);
        if (error) throw error;
      }

      // 3. Update/Insert
      for (const item of editItems) {
        if (item.id) {
          const { error } = await supabase
            .from('funnel_visual_config')
            .update({ stage: item.stage, ordem: item.ordem, visivel: item.visivel, aliases: item.aliases } as any)
            .eq('id', item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('funnel_visual_config')
            .insert({ pipeline: editPipeline, stage: item.stage, ordem: item.ordem, visivel: item.visivel, aliases: item.aliases } as any);
          if (error) throw error;
        }
      }
      toast.success('Funil visual atualizado');
      setEditPipeline(null);
      updateOrder.reset();
      window.location.reload();
    } catch {
      toast.error('Erro ao guardar');
    }
  };

  // Cross-pipeline orphan stages: appear in RAW_EVENTS but missing from funnel_visual_config
  // (neither as canonical stage name nor as alias). These are silently uncounted in KPIs.
  const crossPipelineOrphans = useMemo(() => {
    const out: { pipeline: string; stage: string; leadCount: number }[] = [];
    for (const [pipeline, stageSet] of Object.entries(historicalStagesByPipeline)) {
      const visualForPipeline = config.filter(c => c.pipeline.toLowerCase() === pipeline.toLowerCase());
      const known = new Set<string>();
      for (const v of visualForPipeline) {
        known.add(v.stage);
        for (const a of v.aliases ?? []) known.add(a);
      }
      for (const stage of stageSet) {
        if (known.has(stage)) continue;
        const leadCount = new Set(
          (movementsData?.movements ?? [])
            .filter(m => m.pipeline === pipeline && m.stage.trim() === stage)
            .map(m => m.id),
        ).size;
        out.push({ pipeline, stage, leadCount });
      }
    }
    return out.sort((a, b) => b.leadCount - a.leadCount);
  }, [historicalStagesByPipeline, config, movementsData]);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-secondary/30 border border-border/50 rounded-md px-3 py-2 space-y-1">
        <p>O <strong>funil visual</strong> é a versão canónica das etapas atuais do processo comercial. Os <strong>aliases</strong> agrupam nomes antigos do CRM e <strong>são usados em todos os KPIs e gráficos</strong> que referenciam essa etapa.</p>
        <p className="text-[11px] opacity-80">A ordem definida aqui controla apenas a apresentação na secção <strong>Funil de Vendas</strong>. Para classificar etapas como MQL, Contactados ou SQL, usa as <strong>Regras de Qualificação</strong>.</p>
      </div>

      {crossPipelineOrphans.length > 0 && (
        <Card className="glass-card border-amber-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm font-medium text-amber-400">
                Stages históricas sem cobertura ({crossPipelineOrphans.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Estas stages existem em RAW_EVENTS mas não estão configuradas no funil visual (nem como etapa nem como alias). As leads que passaram por elas <strong>não contam</strong> em nenhum KPI. Edita a pipeline correspondente abaixo para as adicionar como alias da etapa atual.
            </p>
            <div className="space-y-1">
              {crossPipelineOrphans.map(o => (
                <div
                  key={`${o.pipeline}-${o.stage}`}
                  className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded bg-amber-500/5 border border-amber-500/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">{o.pipeline} →</span>
                    <span className="font-medium truncate">{o.stage}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground">{o.leadCount} lead{o.leadCount !== 1 ? 's' : ''}</span>
                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => openEditor(o.pipeline)}>
                      Mapear
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {PIPELINES.map(pipeline => {
        const stages = (grouped[pipeline] ?? []).sort((a, b) => a.ordem - b.ordem);
        return (
          <Card key={pipeline} className="glass-card border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">{pipeline}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => openEditor(pipeline)}>Editar</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-1">
                {stages.length === 0 && <span className="text-xs text-muted-foreground">Sem configuração</span>}
                {stages.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1">
                    <span className={`text-xs px-2 py-1 rounded-md ${s.visivel ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive line-through'}`}>
                      {s.stage}
                    </span>
                    {i < stages.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!editPipeline} onOpenChange={(o) => { if (!o) { setEditPipeline(null); setExpandedAliasIdx(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar funil — {editPipeline}</DialogTitle>
          </DialogHeader>
          {orphanStages.length > 0 && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
              {orphanStages.length} stage(s) histórico(s) sem mapeamento — expande uma etapa abaixo para os associares.
            </div>
          )}
          <div className="space-y-2 py-2">
            {editItems.map((item, idx) => {
              const isExpanded = expandedAliasIdx === idx;
              return (
                <div key={item.stage} className="rounded-lg border border-border bg-secondary/30">
                  <div className="flex items-center gap-2 p-2">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground text-xs disabled:opacity-30">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => moveItem(idx, 1)} disabled={idx === editItems.length - 1} className="text-muted-foreground hover:text-foreground text-xs disabled:opacity-30">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="flex-1 text-sm flex items-center gap-2 flex-wrap">
                      {item.stage}
                      {item.aliases.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                          {item.aliases.length} alias{item.aliases.length > 1 ? 'es' : ''}
                        </span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 text-xs"
                      onClick={() => setExpandedAliasIdx(isExpanded ? null : idx)}
                    >
                      <Tag className="h-3 w-3" />
                      {isExpanded ? 'Fechar' : 'Aliases'}
                    </Button>
                    <Switch checked={item.visivel} onCheckedChange={() => toggleItem(idx)} />
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-border/50">
                      <AliasMapper
                        stageName={item.stage}
                        currentAliases={item.aliases}
                        availableOrphans={orphanStages}
                        onChange={(aliases) => updateItemAliases(idx, aliases)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditPipeline(null); setExpandedAliasIdx(null); }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 3: Mapeamento de fontes ───

interface EditableRow {
  id?: string;
  fonteCRM: string;
  canalDashboard: string;
  tipo: 'Paid Media' | 'Orgânico';
  isNew?: boolean;
  isUnmapped?: boolean;
}

function SourceMappingTab() {
  const { data: mappings, updateMapping, deleteMapping } = useSourceMapping();
  const { data: rawLeads } = useRawLeads();
  const { lastUpdatedAt, refreshCache } = useMetaCreativeNames();

  const handleRefreshCreativeNames = async () => {
    try {
      const result = await refreshCache.mutateAsync();
      toast.success(`Nomes de criativos atualizados (${result.updated} anúncios)`);
    } catch {
      toast.error('Erro ao atualizar nomes do Meta');
    }
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditableRow | null>(null);
  const [newRows, setNewRows] = useState<EditableRow[]>([]);

  // Compute unmapped sources
  const unmappedSources = useMemo(() => {
    if (!rawLeads) return [];
    const mappedFontes = new Set(mappings.map(m => m.fonteCRM));
    const uniqueFontes = new Set(rawLeads.map(l => l.fonte).filter(Boolean));
    return Array.from(uniqueFontes).filter(f => !mappedFontes.has(f));
  }, [rawLeads, mappings]);

  const startEdit = (m: SourceMapping) => {
    setEditingId(m.id);
    setEditRow({ id: m.id, fonteCRM: m.fonteCRM, canalDashboard: m.canalDashboard, tipo: m.tipo });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    try {
      await updateMapping.mutateAsync(editRow);
      toast.success('Mapeamento atualizado');
      setEditingId(null);
      setEditRow(null);
    } catch {
      toast.error('Erro ao guardar');
    }
  };

  const saveNew = async (row: EditableRow, idx: number) => {
    try {
      await updateMapping.mutateAsync(row);
      toast.success('Mapeamento criado');
      setNewRows(prev => prev.filter((_, i) => i !== idx));
    } catch {
      toast.error('Erro ao guardar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMapping.mutateAsync(id);
      toast.success('Mapeamento removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const addNewRow = (fonteCRM = '') => {
    setNewRows(prev => [...prev, { fonteCRM, canalDashboard: '', tipo: 'Paid Media', isNew: true }]);
  };

  const updateNewRow = (idx: number, patch: Partial<EditableRow>) => {
    setNewRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  return (
    <div className="space-y-4">
      {/* Nomes de criativos do Meta */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Nomes de criativos (Meta Ads)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {lastUpdatedAt
              ? `Última atualização: ${new Date(lastUpdatedAt).toLocaleString('pt-PT')}`
              : 'Ainda sem nomes em cache.'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshCreativeNames}
            disabled={refreshCache.isPending}
          >
            {refreshCache.isPending ? 'A atualizar...' : 'Atualizar nomes do Meta'}
          </Button>
        </CardContent>
      </Card>

      {/* Unmapped sources */}
      {unmappedSources.length > 0 && (
        <Card className="glass-card border-amber-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">Fontes por mapear</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unmappedSources.map(s => (
                <Badge
                  key={s}
                  className="bg-amber-500/20 text-amber-400 border-amber-500/30 cursor-pointer hover:bg-amber-500/30"
                  onClick={() => addNewRow(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mapeamento de fontes</CardTitle>
            <Button variant="outline" size="sm" onClick={() => addNewRow()}>
              <Plus className="h-4 w-4 mr-1" /> Novo mapeamento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte no CRM</TableHead>
                <TableHead>Canal no Dashboard</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map(m => (
                <TableRow key={m.id}>
                  {editingId === m.id && editRow ? (
                    <>
                      <TableCell>
                        <Input value={editRow.fonteCRM} onChange={e => setEditRow({ ...editRow, fonteCRM: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input value={editRow.canalDashboard} onChange={e => setEditRow({ ...editRow, canalDashboard: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Select value={editRow.tipo} onValueChange={v => setEditRow({ ...editRow, tipo: v as 'Paid Media' | 'Orgânico' })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Paid Media">Paid Media</SelectItem>
                            <SelectItem value="Orgânico">Orgânico</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={saveEdit}>✓</Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditRow(null); }}>✗</Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="cursor-pointer hover:text-primary" onClick={() => startEdit(m)}>{m.fonteCRM}</TableCell>
                      <TableCell className="cursor-pointer hover:text-primary" onClick={() => startEdit(m)}>{m.canalDashboard}</TableCell>
                      <TableCell className="cursor-pointer hover:text-primary" onClick={() => startEdit(m)}>
                        <Badge variant="outline" className={m.tipo === 'Paid Media' ? 'border-blue-500/50 text-blue-400' : 'border-emerald-500/50 text-emerald-400'}>
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {newRows.map((row, idx) => (
                <TableRow key={`new-${idx}`} className="bg-primary/5">
                  <TableCell>
                    <Input value={row.fonteCRM} onChange={e => updateNewRow(idx, { fonteCRM: e.target.value })} placeholder="Fonte CRM" className="h-8 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Input value={row.canalDashboard} onChange={e => updateNewRow(idx, { canalDashboard: e.target.value })} placeholder="Canal" className="h-8 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Select value={row.tipo} onValueChange={v => updateNewRow(idx, { tipo: v as 'Paid Media' | 'Orgânico' })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid Media">Paid Media</SelectItem>
                        <SelectItem value="Orgânico">Orgânico</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => saveNew(row, idx)}>✓</Button>
                      <Button variant="ghost" size="sm" onClick={() => setNewRows(prev => prev.filter((_, i) => i !== idx))}>✗</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ───

export default function Configuracoes() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Regras de qualificação, funil visual e fontes</p>
        </div>

        <Tabs defaultValue="qualificacao" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="qualificacao">Regras de qualificação</TabsTrigger>
            <TabsTrigger value="funil">Funil visual</TabsTrigger>
            <TabsTrigger value="fontes">Mapeamento de fontes</TabsTrigger>
            <TabsTrigger value="sops">SOPs comerciais</TabsTrigger>
          </TabsList>

          <TabsContent value="qualificacao">
            <QualificationRulesTab />
          </TabsContent>
          <TabsContent value="funil">
            <FunnelVisualTab />
          </TabsContent>
          <TabsContent value="fontes">
            <SourceMappingTab />
          </TabsContent>
          <TabsContent value="sops">
            <SalesPlaybooksSection />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
