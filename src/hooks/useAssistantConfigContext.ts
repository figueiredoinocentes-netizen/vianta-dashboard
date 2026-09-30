import { useMemo } from 'react';
import { useConfigStages, getMQLStagesExpanded, getSQLStagesExpanded, getContactadosConfigExpanded } from './useConfigStages';
import { useFunnelVisualConfig } from './useFunnelVisualConfig';
import { useSourceMapping } from './useSourceMapping';

const PIPELINES = ['Aluguer', 'Compra', 'Slot'];

/**
 * Aggregates the dashboard configuration (qualification rules, visual funnel,
 * source mapping) into a single object ready to send as `context.config` to the
 * AI assistant. Aliases are pre-expanded so the LLM doesn't need to do that work.
 */
export function useAssistantConfigContext() {
  const { data: configs } = useConfigStages();
  const { config: visualConfig } = useFunnelVisualConfig();
  const { data: sourceMappings } = useSourceMapping();

  return useMemo(() => {
    if (!configs || !visualConfig) return null;

    const qualificationRules: Record<string, {
      mql: { stages: string[] };
      contactados: { stages: string[]; prefixoExcluir: string };
      sql: { stages: string[] };
    }> = {};

    for (const pipeline of PIPELINES) {
      qualificationRules[pipeline] = {
        mql: { stages: getMQLStagesExpanded(pipeline, configs, visualConfig) },
        contactados: getContactadosConfigExpanded(pipeline, configs, visualConfig),
        sql: { stages: getSQLStagesExpanded(pipeline, configs, visualConfig) },
      };
    }

    const funnelVisual: Record<string, Array<{ stage: string; ordem: number; visivel: boolean; aliases: string[] }>> = {};
    for (const v of visualConfig) {
      if (!funnelVisual[v.pipeline]) funnelVisual[v.pipeline] = [];
      funnelVisual[v.pipeline].push({
        stage: v.stage,
        ordem: v.ordem,
        visivel: v.visivel,
        aliases: v.aliases ?? [],
      });
    }
    for (const k of Object.keys(funnelVisual)) {
      funnelVisual[k].sort((a, b) => a.ordem - b.ordem);
    }

    const sourceMapping = (sourceMappings ?? []).map(s => ({
      fonteCRM: s.fonteCRM,
      canalDashboard: s.canalDashboard,
      tipo: s.tipo,
    }));

    return { qualificationRules, funnelVisual, sourceMapping };
  }, [configs, visualConfig, sourceMappings]);
}
