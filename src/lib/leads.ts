// Leads da sheet DB Leads Log (aba RAW_LEADS), via a função Netlify `leads` (só leitura).
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

async function listLeads(): Promise<Lead[]> {
  const r = await fetch('/.netlify/functions/leads', { headers: { Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro ao carregar as leads');
  return d as Lead[];
}

export const useLeads = (enabled = true) =>
  useQuery({ queryKey: ['leads'], queryFn: listLeads, enabled, staleTime: 5 * 60_000, retry: false });

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Procura por nome, email ou telemóvel (só dígitos). As mais recentes primeiro. */
export function procurarLeads(leads: Lead[], q: string, max = 8): Lead[] {
  const t = norm(q.trim());
  if (t.length < 2) return [];
  const dig = q.replace(/\D/g, '');
  return leads
    .filter((l) => norm(l.nome).includes(t) || norm(l.email).includes(t) || (dig.length >= 3 && l.telemovel.replace(/\D/g, '').includes(dig)))
    .slice(-200)
    .reverse()
    .slice(0, max);
}
