import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GHLFunnelData, GHLFunnelMetric, GHLStageMetric, GHLEnrichedOpportunity } from '@/types/dashboard';

/**
 * Key stage name patterns per pipeline.
 * Order matters: first = top of funnel, last = bottom.
 */
const KEY_STAGE_PATTERNS: Record<string, string[]> = {
  // Aluguer & Compra share the same pattern
  default: [
    'lead qualificada',
    'dm oferta',
    'visita marcada',
    'acordo verbal',
    'fechado',
  ],
  // Slot 10% has different middle stages
  slot: [
    'lead qualificada',
    'dm pedido de documentos',
    'pedido cota',        // matches "Pedido Cotação Seguro"
    'acordo verbal',
    'fechado',
  ],
};

function getPipelinePatterns(pipelineName: string): string[] {
  const lower = pipelineName.toLowerCase();
  if (lower.includes('slot')) return KEY_STAGE_PATTERNS.slot;
  return KEY_STAGE_PATTERNS.default;
}

function matchesPattern(stageName: string, pattern: string): boolean {
  return stageName.toLowerCase().includes(pattern);
}

async function fetchGHLData(): Promise<GHLFunnelData> {
  const { data, error } = await supabase.functions.invoke('fetch-ghl-data');
  if (error) throw new Error(error.message || 'Erro ao carregar dados do GoHighLevel');
  if (data?.error) throw new Error(data.error);
  return data as GHLFunnelData;
}

/**
 * Compute cumulative funnel metrics from Lead Qualificada.
 *
 * For each key stage we calculate how many opportunities *reached* that stage
 * (i.e. are currently there OR have moved further down the funnel).
 * Conversion rates are always relative to the base (Lead Qualificada).
 */
function computeFunnelMetrics(
  stageMetrics: GHLStageMetric[],
  pipelineId: string,
  pipelineName: string,
): GHLFunnelMetric[] {
  const patterns = getPipelinePatterns(pipelineName);
  const pipelineMetrics = stageMetrics.filter(m => m.pipelineId === pipelineId);

  // Map each pattern to its matching stage metric
  const keyMetrics: { stageName: string; count: number; monetaryValue: number }[] = [];
  for (const pattern of patterns) {
    const match = pipelineMetrics.find(m => matchesPattern(m.stageName, pattern));
    keyMetrics.push({
      stageName: match?.stageName ?? pattern,
      count: match?.count ?? 0,
      monetaryValue: match?.monetaryValue ?? 0,
    });
  }

  // Cumulative from bottom to top: each stage's "reached" = its own count + sum of all below
  const cumulativeCounts: number[] = new Array(keyMetrics.length).fill(0);
  let runningTotal = 0;
  for (let i = keyMetrics.length - 1; i >= 0; i--) {
    runningTotal += keyMetrics[i].count;
    cumulativeCounts[i] = runningTotal;
  }

  const base = cumulativeCounts[0] || 1; // avoid division by zero

  return keyMetrics.map((metric, idx) => ({
    stageName: metric.stageName,
    currentCount: metric.count,
    cumulativeReached: cumulativeCounts[idx],
    conversionFromBase: (cumulativeCounts[idx] / base) * 100,
    monetaryValue: metric.monetaryValue,
  }));
}

export function useGHLData() {
  const query = useQuery({
    queryKey: ['ghl-data'],
    queryFn: fetchGHLData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const funnelMetrics = useMemo(() => {
    if (!query.data) return new Map<string, GHLFunnelMetric[]>();
    const map = new Map<string, GHLFunnelMetric[]>();
    for (const pipeline of query.data.pipelines) {
      map.set(pipeline.id, computeFunnelMetrics(query.data.stageMetrics, pipeline.id, pipeline.name));
    }
    return map;
  }, [query.data]);

  return {
    data: query.data ?? null,
    opportunities: query.data?.opportunities ?? [],
    funnelMetrics,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
