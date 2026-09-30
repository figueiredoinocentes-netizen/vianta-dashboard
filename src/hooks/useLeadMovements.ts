import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RawMovement {
  id: string;
  nome: string;
  pipeline: string;
  stage: string;
  date: string; // ISO string
}

export interface LeadMovementsData {
  movements: RawMovement[];
}

async function fetchLeadMovements(): Promise<LeadMovementsData> {
  const { data, error } = await supabase.functions.invoke('fetch-lead-movements');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return {
    movements: Array.isArray(data?.movements) ? data.movements : [],
  };
}

export function useLeadMovements() {
  return useQuery({
    queryKey: ['lead-movements'],
    queryFn: fetchLeadMovements,
    staleTime: 5 * 60 * 1000,
  });
}
