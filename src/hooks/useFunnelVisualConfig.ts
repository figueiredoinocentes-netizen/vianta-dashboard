import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FunnelVisualConfig } from '@/types/dashboard';

const QUERY_KEY = ['funnel-visual-config'];

async function fetchConfig(): Promise<FunnelVisualConfig[]> {
  const { data, error } = await supabase
    .from('funnel_visual_config')
    .select('*')
    .order('ordem');

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    pipeline: row.pipeline,
    stage: row.stage,
    ordem: row.ordem,
    visivel: row.visivel,
    aliases: (row as any).aliases ?? [],
  }));
}

export function useFunnelVisualConfig() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchConfig,
    staleTime: 60_000,
  });

  const updateOrder = useMutation({
    mutationFn: async (updates: { id: string; ordem: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from('funnel_visual_config')
          .update({ ordem: u.ordem })
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, visivel }: { id: string; visivel: boolean }) => {
      const { error } = await supabase
        .from('funnel_visual_config')
        .update({ visivel })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    config: query.data ?? [],
    isLoading: query.isLoading,
    updateOrder,
    toggleVisibility,
  };
}
