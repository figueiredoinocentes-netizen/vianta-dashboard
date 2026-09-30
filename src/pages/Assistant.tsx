import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, MessageCircle, RefreshCw, Plus, Trash2, PanelLeftClose, PanelLeftOpen, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { useSheetData } from '@/hooks/useSheetData';
import { useGHLData } from '@/hooks/useGHLData';
import { useRawLeads } from '@/hooks/useRawLeads';
import { useLeadMovements } from '@/hooks/useLeadMovements';
import { useAssistantConversations, type AssistantMessage } from '@/hooks/useAssistantConversations';
import { useAssistantConfigContext } from '@/hooks/useAssistantConfigContext';
import { useSalesPlaybooks } from '@/hooks/useSalesPlaybooks';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { GHLNote } from '@/types/dashboard';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const Assistant = () => {
  const {
    conversations,
    activeId,
    activeConversation,
    createConversation,
    selectConversation,
    deleteConversation,
    saveMessages,
  } = useAssistantConversations();

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ghlNotes, setGhlNotes] = useState<Record<string, GHLNote[]>>({});
  const [notesCachedAt, setNotesCachedAt] = useState<string | null>(null);
  const [isRefreshingNotes, setIsRefreshingNotes] = useState(false);
  const [notesProgress, setNotesProgress] = useState<{ cached: number; total: number } | null>(null);
  const backfillRunningRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastLoadedConvIdRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data } = useSheetData({ period: 'all', offerTypes: [], source: 'todos' });
  const { opportunities, data: ghlData } = useGHLData();
  const { data: rawLeads } = useRawLeads();
  const { data: leadMovementsData } = useLeadMovements();
  const configContext = useAssistantConfigContext();
  const { data: playbooks } = useSalesPlaybooks();

  // Sync local messages with active conversation. Triggers when:
  // 1. activeId changes (user picked another conversation), OR
  // 2. The conversation list finishes loading from DB and the active conversation
  //    becomes available for the first time (handles localStorage activeId on mount).
  // Never overwrites local state while streaming an assistant reply.
  useEffect(() => {
    if (isStreamingRef.current) return;
    if (!activeId) {
      if (lastLoadedConvIdRef.current !== null) {
        lastLoadedConvIdRef.current = null;
        setMessages([]);
      }
      return;
    }
    if (!activeConversation) return; // wait for DB to materialize it
    const idChanged = activeId !== lastLoadedConvIdRef.current;
    const becameAvailable =
      lastLoadedConvIdRef.current === activeId &&
      messages.length === 0 &&
      activeConversation.messages.length > 0;
    if (idChanged || becameAvailable) {
      lastLoadedConvIdRef.current = activeId;
      setMessages(activeConversation.messages);
    }
  }, [activeId, activeConversation, messages.length]);

  // Sorted unique contactIds: open first, then won, then others
  const sortedContactIds = useMemo(() => {
    if (!opportunities.length) return [] as string[];
    const priority = (status?: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'open') return 0;
      if (s === 'won') return 1;
      return 2;
    };
    const seen = new Set<string>();
    const sorted = [...opportunities]
      .filter(o => o.contactId)
      .sort((a, b) => priority(a.status) - priority(b.status));
    const ids: string[] = [];
    for (const o of sorted) {
      if (o.contactId && !seen.has(o.contactId)) {
        seen.add(o.contactId);
        ids.push(o.contactId);
      }
    }
    return ids;
  }, [opportunities]);

  const fetchNotes = useCallback(async (forceRefresh = false, mode?: 'backfill') => {
    if (!sortedContactIds.length) return null;
    if (forceRefresh) setIsRefreshingNotes(true);
    try {
      const { data: notesData, error } = await supabase.functions.invoke('fetch-ghl-notes', {
        body: { contactIds: sortedContactIds, forceRefresh, mode },
      });
      if (error) {
        console.warn('[Assistant] Erro ao buscar notas GHL:', error);
        return null;
      }
      if (notesData?.authError) {
        console.warn('[Assistant] Notas GHL indisponíveis — token sem permissão.');
        return null;
      }
      if (notesData?.notes) {
        setGhlNotes(prev => ({ ...prev, ...notesData.notes }));
        setNotesCachedAt(notesData.cachedAt || null);
        if (typeof notesData.cachedCount === 'number' && typeof notesData.totalRequested === 'number') {
          setNotesProgress({ cached: notesData.cachedCount, total: notesData.totalRequested });
        }
        if (forceRefresh) toast.success(`Notas atualizadas (${Object.keys(notesData.notes).length} contactos)`);
        return notesData;
      }
    } catch {
      if (forceRefresh) toast.error('Erro ao atualizar notas');
    } finally {
      if (forceRefresh) setIsRefreshingNotes(false);
    }
    return null;
  }, [sortedContactIds]);

  useEffect(() => {
    if (!sortedContactIds.length || backfillRunningRef.current) return;
    backfillRunningRef.current = true;
    (async () => {
      const initial = await fetchNotes(false);
      let missing = initial?.missingCount ?? 0;
      let rounds = 0;
      const MAX_ROUNDS = 20;
      while (missing > 0 && rounds < MAX_ROUNDS) {
        rounds++;
        // Pequena pausa entre rondas para não saturar o GHL
        await new Promise(r => setTimeout(r, 1500));
        const result = await fetchNotes(false, 'backfill');
        const newMissing = result?.missingCount ?? 0;
        // Para se não houve progresso real (evita loop infinito com erros permanentes)
        if (newMissing >= missing) break;
        missing = newMissing;
      }
      if (missing === 0) {
        toast.success('Notas do CRM carregadas na totalidade');
      } else if (missing > 0) {
        console.warn(`[Assistant] Backfill terminou com ${missing} contactos em falta após ${rounds} rondas`);
      }
      backfillRunningRef.current = false;
    })();
  }, [sortedContactIds, fetchNotes]);

  const ghlContext = useMemo(() => {
    if (!ghlData) return null;
    const MAX_NOTES_PER_CONTACT = 5;
    const MAX_NOTE_BODY_CHARS = 600;

    const trimBody = (s: string) => {
      if (!s) return '';
      const clean = s.replace(/\s+/g, ' ').trim();
      return clean.length > MAX_NOTE_BODY_CHARS ? clean.slice(0, MAX_NOTE_BODY_CHARS) + '…' : clean;
    };

    const sortAndTrim = (notes: GHLNote[]) => {
      return [...notes]
        .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''))
        .slice(0, MAX_NOTES_PER_CONTACT)
        .map(n => ({ body: trimBody(n.body), dateAdded: (n.dateAdded || '').slice(0, 10) }));
    };

    const notesByName: Record<string, { body: string; dateAdded: string }[]> = {};
    const opportunitiesWithNotes: Array<{
      name: string;
      stageName?: string;
      pipelineName?: string;
      status?: string;
      notes: { body: string; dateAdded: string }[];
    }> = [];

    for (const o of opportunities) {
      const notes = o.contactId ? ghlNotes[o.contactId] : undefined;
      if (notes && notes.length) {
        const slimNotes = sortAndTrim(notes);
        opportunitiesWithNotes.push({
          name: o.name,
          stageName: o.stageName,
          pipelineName: o.pipelineName,
          status: o.status,
          notes: slimNotes,
        });
        const keys = [o.contactName, o.name].filter(Boolean) as string[];
        for (const k of keys) {
          const key = k.toLowerCase().trim();
          if (!notesByName[key]) notesByName[key] = slimNotes;
        }
      }
    }

    return {
      pipelines: ghlData.pipelines.map(p => ({ name: p.name, stages: p.stages.map(s => s.name) })),
      opportunities: opportunities.map(o => ({
        name: o.name,
        stageName: o.stageName,
        pipelineName: o.pipelineName,
        status: o.status,
      })),
      opportunitiesWithNotes,
      notesByName,
    };
  }, [ghlData, opportunities, ghlNotes]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-focus no input: ao montar, ao mudar de conversa, e quando o loading termina
  useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [activeId, isLoading]);

  const handleNewConversation = async () => {
    const id = await createConversation();
    if (id) {
      setMessages([]);
      lastLoadedConvIdRef.current = id;
      inputRef.current?.focus();
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Apagar esta conversa?')) return;
    await deleteConversation(id);
    if (id === activeId) setMessages([]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Avisar se o cache de notas ainda não está completo (>5% em falta)
    if (notesProgress && notesProgress.total > 0) {
      const ratio = notesProgress.cached / notesProgress.total;
      if (ratio < 0.95 && backfillRunningRef.current) {
        const proceed = confirm(
          `As notas do CRM ainda estão a carregar (${notesProgress.cached}/${notesProgress.total}).\n\n` +
          `Se enviares agora, o assistente pode não ter contexto sobre todos os leads.\n\n` +
          `Queres enviar mesmo assim?`
        );
        if (!proceed) return;
      }
    }

    // Ensure there's an active conversation
    let convId = activeId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
      lastLoadedConvIdRef.current = convId;
    }

    const userMsg: AssistantMessage = { role: 'user', content: text };
    setInput('');
    const baseMessages = [...messages, userMsg];
    setMessages(baseMessages);
    setIsLoading(true);
    isStreamingRef.current = true;

    // Persist user message immediately so it survives navigation
    saveMessages(convId, baseMessages);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let assistantSoFar = '';
    let aborted = false;

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: baseMessages,
          context: {
            ...(data ? {
              drivers: data.drivers,
              monthlyClosingDetails: data.monthlyClosingDetails,
              kpis: data.kpis,
              fontes: data.fontes,
            } : {}),
            ...(ghlContext ? { ghl: ghlContext } : {}),
            ...(rawLeads ? { rawLeads } : {}),
            ...(leadMovementsData ? { movements: leadMovementsData.movements } : {}),
            ...(configContext ? { config: configContext } : {}),
            ...(playbooks && playbooks.length > 0 ? {
              playbooks: playbooks.map(p => ({
                pipeline: p.pipeline,
                title: p.title,
                content: p.content,
                synced_at: p.synced_at,
              }))
            } : {}),
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro de rede' }));
        toast.error(err.error || `Erro ${resp.status}`);
        setIsLoading(false);
        isStreamingRef.current = false;
        abortControllerRef.current = null;
        return;
      }
      if (!resp.body) {
        toast.error('Sem resposta do servidor');
        setIsLoading(false);
        isStreamingRef.current = false;
        abortControllerRef.current = null;
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        const snapshot = assistantSoFar;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
          }
          return [...prev, { role: 'assistant', content: snapshot }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Persist final state (user + assistant)
      if (assistantSoFar) {
        const finalMessages = [...baseMessages, { role: 'assistant', content: assistantSoFar } as AssistantMessage];
        saveMessages(convId, finalMessages);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        aborted = true;
        if (assistantSoFar) {
          const finalMessages = [...baseMessages, { role: 'assistant', content: assistantSoFar + '\n\n_(resposta interrompida)_' } as AssistantMessage];
          setMessages(finalMessages);
          saveMessages(convId, finalMessages);
        }
        toast.info('Resposta interrompida');
      } else {
        console.error(e);
        toast.error('Erro ao contactar o assistente');
      }
    }

    abortControllerRef.current = null;
    isStreamingRef.current = false;
    setIsLoading(false);
    void aborted;
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
  };

  const formatConvTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-3rem-2*1.5rem)] gap-4">
        {/* Sidebar of conversations */}
        {sidebarOpen && (
          <aside className="w-64 shrink-0 flex flex-col border-r border-border pr-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conversas</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSidebarOpen(false)}
                title="Esconder lista"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 mb-3"
              onClick={handleNewConversation}
            >
              <Plus className="h-4 w-4" />
              Nova conversa
            </Button>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                  Sem conversas. Cria uma para começar.
                </p>
              )}
              {conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`group w-full text-left px-2 py-2 rounded-md text-xs transition-colors flex items-start justify-between gap-2 ${
                    c.id === activeId
                      ? 'bg-primary/15 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-[10px] opacity-60">{formatConvTime(c.updated_at)}</div>
                  </div>
                  <Trash2
                    className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-destructive shrink-0 mt-0.5"
                    onClick={(e) => handleDeleteConversation(c.id, e as any)}
                  />
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSidebarOpen(true)}
                  title="Mostrar conversas"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <div className="h-2.5 w-2.5 rounded-full bg-chart-emerald animate-pulse" />
              <h1 className="font-display text-xl font-bold text-foreground">
                {activeConversation?.title && activeConversation.title !== 'Nova conversa'
                  ? activeConversation.title
                  : 'Assistente Vianta'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {notesProgress && notesProgress.total > 0 && (
                <span className={`text-xs flex items-center gap-1.5 ${
                  notesProgress.cached < notesProgress.total ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {notesProgress.cached < notesProgress.total && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Notas CRM: {notesProgress.cached}/{notesProgress.total}
                  {notesProgress.cached >= notesProgress.total && ' ✓'}
                </span>
              )}
              {notesCachedAt && (
                <span className="text-xs text-muted-foreground">
                  Atualizadas: {new Date(notesCachedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => fetchNotes(true)}
                disabled={isRefreshingNotes}
                title="Atualizar notas do CRM"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshingNotes ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3">
                <MessageCircle className="h-12 w-12 opacity-30" />
                <p className="text-sm">Olá! Sou o assistente da Vianta.</p>
                <p className="text-xs max-w-md text-center">
                  Posso responder a perguntas sobre os dados do dashboard, funil de vendas do CRM, leads em fases específicas, e notas de contactos.
                </p>
                {!activeId && conversations.length > 0 && (
                  <p className="text-xs text-muted-foreground/80">Seleciona uma conversa à esquerda ou começa uma nova.</p>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-xl px-4 py-3 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="pt-4 border-t border-border mt-4">
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Escreve a tua pergunta... (Shift+Enter para nova linha)"
                className="flex-1 min-h-11 max-h-40 resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
              />
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-11 w-11 shrink-0"
                  onClick={stopStreaming}
                  title="Parar resposta"
                >
                  <Square className="h-4 w-4" fill="currentColor" />
                </Button>
              ) : (
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Assistant;
