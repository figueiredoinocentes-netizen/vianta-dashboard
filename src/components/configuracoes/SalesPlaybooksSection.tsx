import { useState } from 'react';
import { BookOpen, RefreshCw, Trash2, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSalesPlaybooks } from '@/hooks/useSalesPlaybooks';

const PIPELINES = ['Compra', 'Aluguer', 'Slot'];

export default function SalesPlaybooksSection() {
  const { data, loading, sync, remove } = useSalesPlaybooks();
  const [pipeline, setPipeline] = useState('Compra');
  const [docUrl, setDocUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!docUrl.trim()) return;
    setIsAdding(true);
    const ok = await sync(pipeline, docUrl.trim());
    if (ok) setDocUrl('');
    setIsAdding(false);
  };

  const handleResync = async (id: string, pipelineName: string, docId: string) => {
    setSyncingId(id);
    await sync(pipelineName, docId);
    setSyncingId(null);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-foreground">Manuais Comerciais (SOPs)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Documentos do Google Docs com o processo de venda por pipeline. O Assistente usa-os como fonte da verdade para responder a perguntas sobre o processo.
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground">A carregar...</p>}
        {!loading && data.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Sem SOPs configurados.</p>
        )}
        {data.map(p => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-background/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">{p.pipeline}</span>
                <span className="text-sm text-foreground truncate">{p.title || '(sem título)'}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                <span>{p.content.length.toLocaleString('pt-PT')} caracteres</span>
                <span>·</span>
                <span>Sync: {new Date(p.synced_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                {p.source_url && (
                  <>
                    <span>·</span>
                    <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                      Abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={syncingId === p.id || !p.source_doc_id}
                onClick={() => p.source_doc_id && handleResync(p.id, p.pipeline, p.source_doc_id)}
                title="Re-sincronizar"
              >
                {syncingId === p.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-destructive"
                onClick={() => { if (confirm(`Remover SOP "${p.pipeline}"?`)) remove(p.id); }}
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Adicionar / atualizar */}
      <div className="pt-4 border-t border-border space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Adicionar ou substituir SOP</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pipeline}
            onChange={e => setPipeline(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {PIPELINES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <Input
            value={docUrl}
            onChange={e => setDocUrl(e.target.value)}
            placeholder="URL ou ID do Google Doc"
            className="flex-1 min-w-[280px]"
          />
          <Button onClick={handleAdd} disabled={isAdding || !docUrl.trim()} className="gap-1.5">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Sincronizar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O documento deve estar acessível pela conta Google ligada via Connectors. Adicionar para uma pipeline existente substitui o SOP anterior.
        </p>
      </div>
    </section>
  );
}
