import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PipelineStageConfig } from '@/types/dashboard';

async function fetchStages(pipelineName: string): Promise<PipelineStageConfig[]> {
  const { data, error } = await supabase
    .from('pipeline_stage_configs')
    .select('*')
    .eq('pipeline_name', pipelineName)
    .order('position');

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map(row => ({
    ...row,
    rule_type: row.rule_type as PipelineStageConfig['rule_type'],
    rule_params: row.rule_params as Record<string, unknown>,
  }));
}

export function usePipelineStages(pipelineName: string) {
  return useQuery({
    queryKey: ['pipeline-stages', pipelineName],
    queryFn: () => fetchStages(pipelineName),
    staleTime: 60_000,
  });
}

export function usePipelineStagesMutations(pipelineName: string) {
  const qc = useQueryClient();
  const key = ['pipeline-stages', pipelineName];

  const upsertStages = useMutation({
    mutationFn: async (stages: Omit<PipelineStageConfig, 'id' | 'created_at'>[]) => {
      // Delete existing
      const { error: delErr } = await supabase
        .from('pipeline_stage_configs')
        .delete()
        .eq('pipeline_name', pipelineName);
      if (delErr) throw delErr;

      // Insert new
      const { error: insErr } = await supabase
        .from('pipeline_stage_configs')
        .insert(stages as any);
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { upsertStages };
}
