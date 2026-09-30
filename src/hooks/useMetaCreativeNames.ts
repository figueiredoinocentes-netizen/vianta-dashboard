import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const QUERY_KEY = ['meta-creative-cache'];

interface MetaCreativeCacheRow {
  ad_id: string;
  ad_name: string;
  spend_last_30d: number | null;
  updated_at: string;
}

async function fetchCache(): Promise<MetaCreativeCacheRow[]> {
  const { data, error } = await supabase
    .from('meta_creative_cache')
    .select('ad_id, ad_name, spend_last_30d, updated_at');
  if (error) throw error;
  return data ?? [];
}

/** IDs de anúncio do Meta são sempre numéricos (ex: "120212345678901234"). */
export function isMetaAdId(value: string): boolean {
  return /^\d+$/.test(value);
}

export function useMetaCreativeNames() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCache,
    staleTime: 5 * 60 * 1000,
  });

  const idToName = useMemo(() => {
    const map = new Map<string, string>();
    (query.data ?? []).forEach((row) => map.set(row.ad_id, row.ad_name));
    return map;
  }, [query.data]);

  const idToSpend = useMemo(() => {
    const map = new Map<string, number>();
    (query.data ?? []).forEach((row) => {
      if (row.spend_last_30d !== null) map.set(row.ad_id, row.spend_last_30d);
    });
    return map;
  }, [query.data]);

  const lastUpdatedAt = useMemo(() => {
    const dates = (query.data ?? []).map((r) => r.updated_at);
    return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  }, [query.data]);

  /** Resolve um valor de criativo: se for um ad_id numérico, devolve o nome atual (ou o próprio ID se ainda não estiver em cache); caso contrário devolve o valor tal como está (nome antigo/histórico). */
  const getCreativeName = useMemo(() => {
    return (value: string): string => {
      if (!isMetaAdId(value)) return value;
      return idToName.get(value) ?? value;
    };
  }, [idToName]);

  /** Gasto (últimos 30 dias) para um ad_id específico, ou null se desconhecido. */
  const getSpend = useMemo(() => {
    return (adId: string): number | null => idToSpend.get(adId) ?? null;
  }, [idToSpend]);

  const refreshCache = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-meta-creative-names');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    isLoading: query.isLoading,
    lastUpdatedAt,
    getCreativeName,
    getSpend,
    refreshCache,
  };
}
