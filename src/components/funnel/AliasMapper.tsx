import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';

interface Props {
  stageName: string;
  currentAliases: string[];
  /** Stages órfãos disponíveis (existem no histórico do CRM mas não estão associados a nenhuma etapa visual) */
  availableOrphans: string[];
  onChange: (aliases: string[]) => void;
}

/** Similaridade simples baseada em tokens partilhados (case-insensitive) */
function similarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

export function AliasMapper({ stageName, currentAliases, availableOrphans, onChange }: Props) {
  const aliasSet = useMemo(() => new Set(currentAliases), [currentAliases]);

  // Orphans ordenados por similaridade ao stageName
  const sortedOrphans = useMemo(() => {
    return [...availableOrphans]
      .map(o => ({ name: o, score: similarity(stageName, o) }))
      .sort((a, b) => b.score - a.score);
  }, [availableOrphans, stageName]);

  const toggleAlias = (alias: string) => {
    if (aliasSet.has(alias)) {
      onChange(currentAliases.filter(a => a !== alias));
    } else {
      onChange([...currentAliases, alias]);
    }
  };

  const removeAlias = (alias: string) => {
    onChange(currentAliases.filter(a => a !== alias));
  };

  const autoSuggest = () => {
    const suggestions = sortedOrphans.filter(o => o.score >= 0.34).map(o => o.name);
    const merged = new Set([...currentAliases, ...suggestions]);
    onChange([...merged]);
  };

  return (
    <div className="space-y-3 pt-2">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Os aliases são selecionados a partir das <strong>stages históricas detetadas no CRM</strong>. Não é possível inventar nomes manualmente — apenas mapear nomes que existiram. Os aliases são aplicados em <strong>todos os KPIs e gráficos</strong>.
      </p>
      {/* Aliases atuais */}
      {currentAliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentAliases.map(a => (
            <Badge key={a} variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1 pr-1">
              {a}
              <button
                onClick={() => removeAlias(a)}
                className="hover:bg-destructive/20 rounded-sm p-0.5"
                aria-label={`Remover alias ${a}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Stages órfãos disponíveis */}
      {sortedOrphans.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              Stages históricas disponíveis ({sortedOrphans.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={autoSuggest}
            >
              <Sparkles className="h-3 w-3" />
              Auto-sugerir
            </Button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {sortedOrphans.map(({ name, score }) => {
              const checked = aliasSet.has(name);
              return (
                <label
                  key={name}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-secondary/50 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleAlias(name)}
                  />
                  <span className="text-xs flex-1">{name}</span>
                  {score >= 0.34 && (
                    <span className="text-[10px] text-primary/70">
                      ~{Math.round(score * 100)}%
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">
          Não existem stages históricas por mapear nesta pipeline.
        </p>
      )}
    </div>
  );
}
