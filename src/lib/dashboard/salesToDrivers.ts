import type { Driver } from '@/types/dashboard';

export interface SupabaseSale {
  id: number;
  tipo: string;
  carro_id: number | null;
  motorista_id: number | null;
  ghl_contact_id: string | null;
  cliente_nome: string | null;
  data_lead: string | null;
  data_entrada: string | null;
  data_saida: string | null;
  valor_total: number | string | null;
  valor_semanal: number | string | null;
  fonte: string | null;
}

function numericValue(value: number | string | null): number | null {
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Map authoritative sale/contract rows into the existing dashboard KPI model. */
export function salesToDrivers(sales: SupabaseSale[]): Driver[] {
  return sales.flatMap((sale) => {
    if (!['compra', 'aluguer', 'slot'].includes(sale.tipo)) return [];
    const identity = sale.ghl_contact_id || (sale.motorista_id != null ? `motorista-${sale.motorista_id}` : null);
    if (!identity) return [];

    return [{
      id: identity,
      nome: sale.cliente_nome || 'Sem nome registado',
      fonte: sale.fonte || 'Sem atribuição',
      tipoOferta: sale.tipo,
      ticket: sale.tipo === 'compra'
        ? numericValue(sale.valor_total)
        : numericValue(sale.valor_semanal),
      dataFecho: sale.data_entrada,
      dataLead: sale.data_lead,
      dataSaida: sale.data_saida,
      motivoPerda: null,
      observacoes: null,
    }];
  });
}
