import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MonthlyObjective } from '@/types/dashboard';

const QUERY_KEY = ['monthly-objectives'];

async function fetchObjectives(): Promise<MonthlyObjective[]> {
  const { data, error } = await supabase
    .from('monthly_objectives')
    .select('*')
    .order('mes', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    mes: row.mes,
    oferta: row.oferta,
    revenueAlvo: Number(row.revenue_alvo),
    fechosAlvo: row.fechos_alvo,
    sqlsAlvo: row.sqls_alvo,
    leadsAlvo: row.leads_alvo,
    budgetAlvo: Number(row.budget_alvo),
    preAprovacaoAlvo: Number(row.pre_aprovacao_alvo ?? 0),
  }));
}

export function useMonthlyObjectives() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchObjectives,
    staleTime: 60_000,
  });

  const upsertObjective = useMutation({
    mutationFn: async (obj: Omit<MonthlyObjective, 'id'> & { id?: string }) => {
      const { error } = await supabase
        .from('monthly_objectives')
        .upsert(
          {
            mes: obj.mes,
            oferta: obj.oferta,
            revenue_alvo: obj.revenueAlvo,
            fechos_alvo: obj.fechosAlvo,
            sqls_alvo: obj.sqlsAlvo,
            leads_alvo: obj.leadsAlvo,
            budget_alvo: obj.budgetAlvo,
            pre_aprovacao_alvo: obj.preAprovacaoAlvo,
          },
          { onConflict: 'mes,oferta' }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteObjective = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('monthly_objectives')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const objectives = query.data ?? [];

  const getObjective = (oferta: string, mes: string): MonthlyObjective | null =>
    objectives.find(o => o.oferta === oferta && o.mes === mes) ?? null;

  const getObjectivesForMonth = (mes: string): MonthlyObjective[] =>
    objectives.filter(o => o.mes === mes);

  return {
    data: objectives,
    isLoading: query.isLoading,
    upsertObjective,
    deleteObjective,
    getObjective,
    getObjectivesForMonth,
  };
}
