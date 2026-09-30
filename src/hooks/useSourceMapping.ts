import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SourceMapping } from '@/types/dashboard';

const QUERY_KEY = ['source-mapping'];

async function fetchMappings(): Promise<SourceMapping[]> {
  const { data, error } = await supabase
    .from('source_mapping')
    .select('*')
    .order('fonte_crm');

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    fonteCRM: row.fonte_crm,
    canalDashboard: row.canal_dashboard,
    tipo: row.tipo as SourceMapping['tipo'],
  }));
}

export function useSourceMapping() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMappings,
    staleTime: 60_000,
  });

  const updateMapping = useMutation({
    mutationFn: async (mapping: Omit<SourceMapping, 'id'> & { id?: string }) => {
      if (mapping.id) {
        const { error } = await supabase
          .from('source_mapping')
          .update({
            fonte_crm: mapping.fonteCRM,
            canal_dashboard: mapping.canalDashboard,
            tipo: mapping.tipo,
          })
          .eq('id', mapping.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('source_mapping')
          .insert({
            fonte_crm: mapping.fonteCRM,
            canal_dashboard: mapping.canalDashboard,
            tipo: mapping.tipo,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('source_mapping')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    updateMapping,
    deleteMapping,
  };
}

// --- Helpers (pure functions) ---

export function getCanal(fonteCRM: string, mappings: SourceMapping[]): string {
  const m = mappings.find(m => m.fonteCRM === fonteCRM);
  return m?.canalDashboard ?? fonteCRM;
}

export function getTipo(fonteCRM: string, mappings: SourceMapping[]): 'Paid Media' | 'Orgânico' | null {
  const m = mappings.find(m => m.fonteCRM === fonteCRM);
  return m?.tipo ?? null;
}
