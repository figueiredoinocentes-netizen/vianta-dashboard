export interface CreativeMetrics {
  adSet: string;
  criativo: string;
  totalLeads: number;
  totalSQLs: number;
  totalFechos: number;
  taxaLeadSQL: number;
  taxaSQLFecho: number | null;
  diasDesdeRegistoMedio: number;
  statusMaturacao: 'maduro' | 'em_maturacao';
}
