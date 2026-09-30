import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RawLead } from '@/types/dashboard';

async function fetchRawLeads(): Promise<RawLead[]> {
  const { data, error } = await supabase.functions.invoke('fetch-raw-leads');
  if (error) throw error;
  return data.leads ?? [];
}

export function useRawLeads() {
  return useQuery({
    queryKey: ['raw-leads'],
    queryFn: fetchRawLeads,
    staleTime: 5 * 60 * 1000,
  });
}
