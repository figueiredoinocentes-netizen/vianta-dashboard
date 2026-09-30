import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetaInsightDailyRow {
  date: string;
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  cpm: number | null;
  ctr: number | null;
  clicks: number | null;
  spend: number | null;
  landing_page_views: number | null;
  leads: number | null;
  cost_per_lead: number | null;
  updated_at: string;
}

async function fetchMetaInsights(): Promise<MetaInsightDailyRow[]> {
  const { data, error } = await supabase
    .from('meta_insights_daily')
    .select('*');
  if (error) throw error;
  return data ?? [];
}

/**
 * Linhas diárias de meta_insights_daily (granularidade dia x ad_id). Não agrega —
 * cada consumidor agrupa/soma conforme necessário (por ad_id, adset_id, data,
 * numa janela diferente), já que diferentes páginas querem diferentes recortes.
 */
export function useMetaInsights() {
  return useQuery({
    queryKey: ['meta-insights-daily'],
    queryFn: fetchMetaInsights,
    staleTime: 5 * 60 * 1000,
  });
}
