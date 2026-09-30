import { useMemo } from 'react';
import { useRawLeads } from './useRawLeads';
import { useLeadMovements } from './useLeadMovements';
import { useSheetData } from './useSheetData';
import { computeCreativeMetrics } from '@/lib/creativeQuality';
import type { CreativeMetrics } from '@/types/creativeQuality';

interface UseCreativeQualityResult {
  metrics: CreativeMetrics[];
  isLoading: boolean;
}

export function useCreativeQuality(): UseCreativeQualityResult {
  try {
    const { data: rawLeads = [], isLoading: leadsLoading } = useRawLeads();
    const { data: movementsData, isLoading: movementsLoading } = useLeadMovements();
    const { data: sheetData, isLoading: sheetLoading } = useSheetData({ period: 'all', offerTypes: ['slot', 'aluguer', 'compra'], source: 'all' });

    const movements = movementsData?.movements ?? [];
    const isLoading = leadsLoading || movementsLoading || sheetLoading;

    const metrics = useMemo(() => {
      try {
        if (isLoading || !rawLeads || !movements) {
          return [];
        }

        const sqlStages = ['DM Whatsapp', 'Visita Marcada', 'Visita Efetivada', 'Fechado', 'Fecho'];
        const closureStages = ['Fechado', 'Fecho'];
        const cicloMedioDias = sheetData?.kpis?.cicloVendaMedio || 30;

        return computeCreativeMetrics(rawLeads, movements, sqlStages, closureStages, cicloMedioDias);
      } catch (error) {
        console.error('Error computing creative metrics:', error);
        return [];
      }
    }, [rawLeads, movements, sheetData, isLoading]);

    return { metrics, isLoading };
  } catch (error) {
    console.error('Error in useCreativeQuality:', error);
    return { metrics: [], isLoading: false };
  }
}
