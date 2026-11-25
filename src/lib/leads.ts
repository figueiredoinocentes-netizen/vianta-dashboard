// Leads da sheet DB Leads Log (aba RAW_LEADS), via a função Netlify `leads` (só leitura).
// A função nunca devolve a lista inteira: só pesquisa (mín. 3 caracteres) ou leads por ID.
import { useQuery } from '@tanstack/react-query';

export interface Lead {
  /** ID da lead no GHL (coluna "ID") — é o que fica em `financeiro.ghl_lead_id`. */
  id: string;
  nome: string;
  email: string;
  telemovel: string;
  oferta: string;
  data: string;
  fonte: string;
  campanha: string;
  adset: string;
  criativo: string;
}

async function getLeads(params: string): Promise<Lead[]> {
  const r = await fetch(`/.netlify/functions/leads?${params}`, { headers: { Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro ao carregar as leads');
  return d as Lead[];
}

/** Pesquisa por nome, email ou telemóvel (mín. 3 caracteres). */
export const useProcurarLeads = (q: string) => {
  const t = q.trim();
  return useQuery({
    queryKey: ['leads', 'q', t],
    queryFn: () => getLeads(`q=${encodeURIComponent(t)}`),
    enabled: t.length >= 3,
    staleTime: 60_000,
    retry: false,
  });
};

/** Leads por ID (para mostrar campanha/criativo das vendas). */
export const useLeadsPorId = (ids: string[]) => {
  const unicos = [...new Set(ids.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['leads', 'ids', unicos.join(',')],
    queryFn: () => getLeads(`ids=${encodeURIComponent(unicos.join(','))}`),
    enabled: unicos.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
};
