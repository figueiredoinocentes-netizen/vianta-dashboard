import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ActionItemStatus = 'todo' | 'em_curso' | 'feito';
export type ActionItemPriority = 'alta' | 'media' | 'baixa';

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: ActionItemPriority | null;
  status: ActionItemStatus;
  createdAt: string;
  updatedAt: string;
}

const QUERY_KEY = ['action-items'];

async function fetchActionItems(): Promise<ActionItem[]> {
  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority as ActionItemPriority | null,
    status: row.status as ActionItemStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export interface NewActionItem {
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: ActionItemPriority | null;
}

export function useActionItems() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchActionItems,
    staleTime: 60_000,
  });

  const createItem = useMutation({
    mutationFn: async (item: NewActionItem) => {
      const { error } = await supabase.from('action_items').insert({
        title: item.title,
        description: item.description ?? null,
        category: item.category ?? null,
        priority: item.priority ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...changes }: { id: string } & Partial<Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const { error } = await supabase
        .from('action_items')
        .update(changes)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('action_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    createItem,
    updateItem,
    deleteItem,
  };
}
