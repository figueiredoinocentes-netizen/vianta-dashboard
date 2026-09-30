import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };

export type AssistantConversation = {
  id: string;
  title: string;
  messages: AssistantMessage[];
  created_at: string;
  updated_at: string;
};

const ACTIVE_KEY = 'vianta.assistant.activeConversationId';

function deriveTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 57) + '…';
}

export function useAssistantConversations() {
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(true);

  // Persist activeId to localStorage so it survives navigation between sections
  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch { /* ignore */ }
  }, [activeId]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('assistant_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('[useAssistantConversations] load error', error);
      setIsLoading(false);
      return;
    }
    const rows = (data ?? []).map(r => ({
      id: r.id,
      title: r.title,
      messages: (r.messages as unknown as AssistantMessage[]) ?? [],
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    setConversations(rows);
    // If activeId no longer exists, clear it
    if (activeId && !rows.find(r => r.id === activeId)) {
      setActiveId(null);
    }
    setIsLoading(false);
  }, [activeId]);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConversation = conversations.find(c => c.id === activeId) ?? null;

  const createConversation = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('assistant_conversations')
      .insert({ title: 'Nova conversa', messages: [] })
      .select('*')
      .single();
    if (error || !data) {
      toast.error('Erro ao criar conversa');
      return null;
    }
    const conv: AssistantConversation = {
      id: data.id,
      title: data.title,
      messages: [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    return conv.id;
  }, []);

  const selectConversation = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const { error } = await supabase.from('assistant_conversations').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao apagar conversa');
      return;
    }
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId]);

  /**
   * Persist the full message array for a conversation. If the conversation
   * still has the default title, derive a title from the first user message.
   */
  const saveMessages = useCallback(async (id: string, messages: AssistantMessage[]) => {
    const existing = conversations.find(c => c.id === id);
    const shouldRename = existing && existing.title === 'Nova conversa';
    const firstUser = messages.find(m => m.role === 'user');
    const title = shouldRename && firstUser ? deriveTitle(firstUser.content) : existing?.title ?? 'Nova conversa';

    const updated_at = new Date().toISOString();
    // Optimistic update
    setConversations(prev => {
      const next = prev.map(c => c.id === id ? { ...c, messages, title, updated_at } : c);
      // Re-sort by updated_at desc
      return next.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    });

    const { error } = await supabase
      .from('assistant_conversations')
      .update({ messages: messages as any, title, updated_at })
      .eq('id', id);
    if (error) console.warn('[useAssistantConversations] save error', error);
  }, [conversations]);

  return {
    conversations,
    activeId,
    activeConversation,
    isLoading,
    createConversation,
    selectConversation,
    deleteConversation,
    saveMessages,
    reload: loadAll,
  };
}
