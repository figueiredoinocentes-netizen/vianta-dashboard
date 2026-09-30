import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PipelineStageConfig, FunnelVisualConfig } from '@/types/dashboard';

async function fetchAllConfigs(): Promise<PipelineStageConfig[]> {
  const { data, error } = await supabase
    .from('pipeline_stage_configs')
    .select('*')
    .order('position');

  if (error) throw error;

  return (data ?? []).map(row => ({
    ...row,
    rule_type: row.rule_type as PipelineStageConfig['rule_type'],
    rule_params: row.rule_params as Record<string, unknown>,
  }));
}

export function useConfigStages() {
  return useQuery({
    queryKey: ['config-stages'],
    queryFn: fetchAllConfigs,
    staleTime: 60_000,
  });
}

// --- Helpers (pure functions, receive the configs array) ---

export function getMQLStages(pipeline: string, configs: PipelineStageConfig[]): string[] {
  const cfg = configs.find(
    c => c.pipeline_name === pipeline && c.stage_key === 'mql' && c.rule_type === 'match_stages'
  );
  return (cfg?.rule_params?.stages as string[]) ?? [];
}

export function getSQLStages(pipeline: string, configs: PipelineStageConfig[]): string[] {
  const cfg = configs.find(
    c => c.pipeline_name === pipeline && c.rule_type === 'reached_any'
  );
  return (cfg?.rule_params?.stages as string[]) ?? [];
}

export function getContactadosConfig(
  pipeline: string,
  configs: PipelineStageConfig[]
): { stages: string[]; prefixoExcluir: string } {
  const cfg = configs.find(
    c => c.pipeline_name === pipeline && c.rule_type === 'contacted'
  );
  return {
    stages: (cfg?.rule_params?.mql_stages as string[]) ?? [],
    prefixoExcluir: (cfg?.rule_params?.exclude_prefix as string) ?? '',
  };
}

// --- Alias-expansion helpers ---
// The funnel visual config (`funnel_visual_config`) is the canonical version of
// the current pipeline stages. Each visual stage may carry `aliases` for old/renamed
// CRM stage names. KPI rules reference visual stages, and at evaluation time we
// expand each referenced stage with its aliases so historical movements still count.

/** Build a Map<canonicalOrAliasName, fullEquivalenceSet> for a given pipeline */
function buildAliasMap(pipeline: string, visualConfig: FunnelVisualConfig[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const v of visualConfig) {
    if (v.pipeline.toLowerCase() !== pipeline.toLowerCase()) continue;
    const equivalents = new Set<string>([v.stage, ...(v.aliases ?? [])]);
    for (const name of equivalents) {
      map.set(name, equivalents);
    }
  }
  return map;
}

/** Expand a list of stage names with their aliases (from funnel_visual_config) for a pipeline */
export function expandStagesWithAliases(
  stages: string[],
  pipeline: string,
  visualConfig: FunnelVisualConfig[]
): string[] {
  const aliasMap = buildAliasMap(pipeline, visualConfig);
  const expanded = new Set<string>();
  for (const s of stages) {
    const eq = aliasMap.get(s);
    if (eq) {
      eq.forEach(n => expanded.add(n));
    } else {
      expanded.add(s);
    }
  }
  return [...expanded];
}

/** Same as getMQLStages but expanded with aliases from the visual config */
export function getMQLStagesExpanded(
  pipeline: string,
  configs: PipelineStageConfig[],
  visualConfig: FunnelVisualConfig[]
): string[] {
  return expandStagesWithAliases(getMQLStages(pipeline, configs), pipeline, visualConfig);
}

/** Same as getSQLStages but expanded with aliases from the visual config */
export function getSQLStagesExpanded(
  pipeline: string,
  configs: PipelineStageConfig[],
  visualConfig: FunnelVisualConfig[]
): string[] {
  return expandStagesWithAliases(getSQLStages(pipeline, configs), pipeline, visualConfig);
}

/** Same as getContactadosConfig but with stages expanded by aliases */
export function getContactadosConfigExpanded(
  pipeline: string,
  configs: PipelineStageConfig[],
  visualConfig: FunnelVisualConfig[]
): { stages: string[]; prefixoExcluir: string } {
  const base = getContactadosConfig(pipeline, configs);
  return {
    stages: expandStagesWithAliases(base.stages, pipeline, visualConfig),
    prefixoExcluir: base.prefixoExcluir,
  };
}

/** Returns just the aliases (excluding the canonical name) for a given visual stage in a pipeline */
export function getAliasesForStage(
  stage: string,
  pipeline: string,
  visualConfig: FunnelVisualConfig[]
): string[] {
  const v = visualConfig.find(
    x => x.pipeline.toLowerCase() === pipeline.toLowerCase() && x.stage === stage
  );
  return v?.aliases ?? [];
}
