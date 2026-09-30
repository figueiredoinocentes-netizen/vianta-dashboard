import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, X } from 'lucide-react';
import { usePipelineStagesMutations } from '@/hooks/usePipelineStages';
import type { PipelineStageConfig } from '@/types/dashboard';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineName: string;
  stages: PipelineStageConfig[];
  ghlStageNames?: string[];
  /** Optional map of visual-stage-name → list of aliases. Used to show users what
   *  historical CRM names will also be matched by each selected stage. */
  aliasesByStage?: Record<string, string[]>;
}

interface EditableStage {
  stage_key: string;
  stage_label: string;
  rule_type: PipelineStageConfig['rule_type'];
  selected_stages: string[];
  exclude_prefix: string;
}

function toEditable(s: PipelineStageConfig): EditableStage {
  const params = s.rule_params as Record<string, unknown>;
  const stagesList = (params.stages || params.mql_stages || []) as string[];
  return {
    stage_key: s.stage_key,
    stage_label: s.stage_label,
    rule_type: s.rule_type,
    selected_stages: stagesList,
    exclude_prefix: (params.exclude_prefix as string) || '',
  };
}

function toSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function StageAutocomplete({
  selected,
  suggestions,
  onChange,
  aliasesByStage,
}: {
  selected: string[];
  suggestions: string[];
  onChange: (stages: string[]) => void;
  aliasesByStage?: Record<string, string[]>;
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    s => !selected.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  );

  const addStage = (name: string) => {
    onChange([...selected, name]);
    setQuery('');
  };

  const removeStage = (name: string) => {
    onChange(selected.filter(s => s !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      if (filtered.length > 0) {
        addStage(filtered[0]);
      } else {
        addStage(query.trim());
      }
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1 p-1.5 border border-border rounded-md bg-background min-h-[34px]">
        {selected.map(s => {
          const aliases = aliasesByStage?.[s] ?? [];
          return (
            <div key={s} className="flex flex-col gap-0.5">
              <Badge variant="secondary" className="text-xs gap-1 pr-1">
                {s}
                <button onClick={() => removeStage(s)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              {aliases.length > 0 && (
                <span className="text-[10px] text-muted-foreground pl-1" title={aliases.join(', ')}>
                  + inclui: {aliases.join(', ')}
                </span>
              )}
            </div>
          );
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? 'Pesquisar stages...' : ''}
          className="flex-1 min-w-[80px] text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showDropdown && (filtered.length > 0 || (query && suggestions.length > 0)) && (
        <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map(s => (
            <button
              key={s}
              onClick={() => { addStage(s); setShowDropdown(false); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {s}
            </button>
          ))}
          {filtered.length === 0 && query && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              Enter para adicionar "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineStageEditor({ open, onOpenChange, pipelineName, stages, ghlStageNames = [], aliasesByStage }: Props) {
  const [items, setItems] = useState<EditableStage[]>([]);
  const { upsertStages } = usePipelineStagesMutations(pipelineName);

  useEffect(() => {
    if (open) {
      setItems(stages.map(toEditable));
    }
  }, [open, stages]);

  const updateItem = (idx: number, patch: Partial<EditableStage>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, { stage_key: '', stage_label: '', rule_type: 'match_stages', selected_stages: [], exclude_prefix: '' }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    setItems(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const handleSave = async () => {
    const mapped = items.map((item, i) => {
      const key = item.stage_key || toSlug(item.stage_label) || `stage_${i}`;

      let rule_params: Record<string, unknown> = {};
      if (item.rule_type === 'match_stages') {
        rule_params = { stages: item.selected_stages };
      } else if (item.rule_type === 'contacted') {
        rule_params = { mql_stages: item.selected_stages, exclude_prefix: item.exclude_prefix || 'Não Atendeu' };
      } else if (item.rule_type === 'reached_any') {
        rule_params = { stages: item.selected_stages };
      }

      return {
        pipeline_name: pipelineName,
        stage_key: key,
        stage_label: item.stage_label,
        position: i,
        rule_type: item.rule_type,
        rule_params,
      };
    });

    try {
      await upsertStages.mutateAsync(mapped);
      toast.success('Fases atualizadas');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao guardar fases');
    }
  };

  const ruleLabel = (r: string) => {
    if (r === 'match_stages') return 'Match Stages';
    if (r === 'contacted') return 'Contactados';
    if (r === 'reached_any') return 'Alcançou Qualquer';
    return r;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar fases — {pipelineName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/30">
              <div className="flex flex-col gap-1 mt-1">
                <button onClick={() => moveItem(idx, -1)} className="text-muted-foreground hover:text-foreground text-xs" disabled={idx === 0}>▲</button>
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <button onClick={() => moveItem(idx, 1)} className="text-muted-foreground hover:text-foreground text-xs" disabled={idx === items.length - 1}>▼</button>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nome da fase</Label>
                  <Input
                    value={item.stage_label}
                    onChange={e => updateItem(idx, { stage_label: e.target.value })}
                    placeholder="Ex: MQL"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo de regra</Label>
                  <Select value={item.rule_type} onValueChange={v => updateItem(idx, { rule_type: v as EditableStage['rule_type'] })}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="match_stages">{ruleLabel('match_stages')}</SelectItem>
                      <SelectItem value="contacted">{ruleLabel('contacted')}</SelectItem>
                      <SelectItem value="reached_any">{ruleLabel('reached_any')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Etapas do funil incluídas</Label>
                  <p className="text-[10px] text-muted-foreground mb-1">
                    Escolhe etapas do <strong>funil visual atual</strong>. Os aliases configurados em cada etapa são incluídos automaticamente.
                  </p>
                  <StageAutocomplete
                    selected={item.selected_stages}
                    suggestions={ghlStageNames}
                    onChange={stages => updateItem(idx, { selected_stages: stages })}
                    aliasesByStage={aliasesByStage}
                  />
                </div>
                {item.rule_type === 'contacted' && (
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Prefixo a excluir</Label>
                    <Input
                      value={item.exclude_prefix}
                      onChange={e => updateItem(idx, { exclude_prefix: e.target.value })}
                      placeholder="Não Atendeu"
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeItem(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addItem} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Adicionar fase
        </Button>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsertStages.isPending}>
            {upsertStages.isPending ? 'A guardar...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
