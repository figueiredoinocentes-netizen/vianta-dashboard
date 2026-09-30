import type { RawLead } from '@/types/dashboard';
import type { RawMovement } from '@/hooks/useLeadMovements';
import type { CreativeMetrics } from '@/types/creativeQuality';
import { parseISO, differenceInDays } from 'date-fns';

export function computeCreativeMetrics(
  rawLeads: RawLead[],
  movements: RawMovement[],
  sqlStages: string[],
  closureStages: string[],
  cicloMedioDias: number,
): CreativeMetrics[] {
  console.log('[creativeQuality] Input:', { rawLeadsCount: rawLeads.length, movementsCount: movements.length, sqlStages, closureStages });

  if (rawLeads.length === 0) {
    console.warn('[creativeQuality] No raw leads!');
  }
  if (movements.length === 0) {
    console.warn('[creativeQuality] No movements!');
  }

  // Agrupar leads por adSet + criativo
  const groups = new Map<string, RawLead[]>();

  for (const lead of rawLeads) {
    const adSet = lead.adSet || 'sem_adset';
    const criativo = lead.criativo || 'sem_criativo';

    if (!adSet || adSet === 'sem_adset' || !criativo || criativo === 'sem_criativo') {
      console.log('[creativeQuality] Lead with missing adSet/criativo:', { adSet, criativo, nome: lead.nome });
    }

    const key = `${adSet}|${criativo}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(lead);
  }

  console.log('[creativeQuality] Groups created:', groups.size);
  if (groups.size > 0) {
    console.log('[creativeQuality] Group keys:', Array.from(groups.keys()).slice(0, 5));
  }

  const results: CreativeMetrics[] = [];
  const now = new Date();

  for (const [key, leads] of groups.entries()) {
    const [adSetPart, criativoPart] = key.split('|');
    const adSet = adSetPart === 'sem_adset' ? 'Sem atribuição' : adSetPart;
    const criativo = criativoPart === 'sem_criativo' ? 'Sem atribuição' : criativoPart;

    const totalLeads = leads.length;
    if (totalLeads === 0) continue;

    const leadNames = new Set(leads.map(l => l.nome));

    // Contar SQLs
    const sqlLeads = new Set<string>();
    for (const movement of movements) {
      if (leadNames.has(movement.nome) && sqlStages.includes(movement.stage)) {
        sqlLeads.add(movement.nome);
      }
    }
    const totalSQLs = sqlLeads.size;

    // Contar Fechos
    const closedLeads = new Set<string>();
    for (const movement of movements) {
      if (leadNames.has(movement.nome) && closureStages.includes(movement.stage)) {
        closedLeads.add(movement.nome);
      }
    }
    const totalFechos = closedLeads.size;

    // Calcular taxas
    const taxaLeadSQL = totalLeads > 0 ? (totalSQLs / totalLeads) * 100 : 0;
    const taxaSQLFecho = totalSQLs > 0 ? (totalFechos / totalSQLs) * 100 : null;

    // Calcular dias desde registo médio
    let diasDesdeRegistoMedio = 0;
    let diasCount = 0;
    for (const lead of leads) {
      if (lead.dataRegisto) {
        try {
          const leadDate = parseISO(lead.dataRegisto);
          const dias = differenceInDays(now, leadDate);
          diasDesdeRegistoMedio += dias;
          diasCount++;
        } catch {
          // Ignorar datas inválidas
        }
      }
    }
    if (diasCount > 0) {
      diasDesdeRegistoMedio = Math.round(diasDesdeRegistoMedio / diasCount);
    }

    const statusMaturacao = diasDesdeRegistoMedio >= cicloMedioDias ? 'maduro' : 'em_maturacao';

    results.push({
      adSet,
      criativo,
      totalLeads,
      totalSQLs,
      totalFechos,
      taxaLeadSQL,
      taxaSQLFecho,
      diasDesdeRegistoMedio,
      statusMaturacao,
    });
  }

  // Ordenar
  results.sort((a, b) => {
    if (a.taxaSQLFecho === null && b.taxaSQLFecho === null) {
      return b.taxaLeadSQL - a.taxaLeadSQL;
    }
    if (a.taxaSQLFecho === null) return 1;
    if (b.taxaSQLFecho === null) return -1;
    if (a.taxaSQLFecho !== b.taxaSQLFecho) {
      return b.taxaSQLFecho - a.taxaSQLFecho;
    }
    return b.taxaLeadSQL - a.taxaLeadSQL;
  });

  return results;
}
