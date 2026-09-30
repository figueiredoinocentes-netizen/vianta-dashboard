import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SalesPlaybook {
  id: string;
  pipeline: string;
  title: string;
  content: string;
  source_url: string | null;
  source_doc_id: string | null;
  synced_at: string;
}

export function useSalesPlaybooks() {
  const [data, setData] = useState<SalesPlaybook[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('sales_playbooks')
      .select('*')
      .order('pipeline');
    if (error) {
      console.warn('[useSalesPlaybooks] erro:', error);
    } else {
      setData((rows || []) as SalesPlaybook[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sync = useCallback(async (pipeline: string, docIdOrUrl: string) => {
    const { data: result, error } = await supabase.functions.invoke('sync-sales-playbook', {
      body: { pipeline, docId: docIdOrUrl },
    });
    if (error || (result && (result as any).error)) {
      const msg = error?.message || (result as any)?.error || 'Erro a sincronizar';
      toast.error(msg);
      return false;
    }
    toast.success(`SOP "${(result as any)?.title || pipeline}" sincronizado (${(result as any)?.charCount || 0} chars)`);
    await refresh();
    return true;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('sales_playbooks').delete().eq('id', id);
    if (error) {
      toast.error('Erro a remover SOP');
      return false;
    }
    toast.success('SOP removido');
    await refresh();
    return true;
  }, [refresh]);

  return { data, loading, refresh, sync, remove };
}
