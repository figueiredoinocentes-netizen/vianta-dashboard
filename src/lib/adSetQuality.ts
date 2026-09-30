import type { RawLead } from '@/types/dashboard';
import type { RawMovement } from '@/hooks/useLeadMovements';
import type { MetaInsightDailyRow } from '@/hooks/useMetaInsights';
import type { AdSetQualityRow } from '@/types/adSetQuality';
import { parseISO, differenceInDays } from 'date-fns';

/**
 * Uma lead precisa de tempo após o registo antes de poder realisticamente ter
 * atingido SQL — a mediana de tempo-até-SQL nesta conta é ~1.5 dias, p75 ~2.9,
 * p90 ~9.8 (medido a partir de RAW_LEADS + RAW_EVENTS). Leads com menos de
 * SQL_MATURATION_DAYS dias desde o registo são excluídas do cálculo de
 * taxa/custo por SQL para não penalizar injustamente ad sets/criativos
 * recém-lançados.
 */
export const SQL_MATURATION_DAYS = 5;

/**
 * Calcula métricas de qualidade (SQL, taxa, custo) agrupadas por Ad Set,
 * com criativo(s) como contexto secundário e exclusão de leads "em maturação".
 *
 * Gasto/impressões/cliques/LP-views vêm de `meta_insights_daily` (granularidade
 * diária, dados reais do Meta), somados pelos ad_ids associados a cada ad set
 * (mesma lógica de mapeamento ad_id -> ad set usada para `criativos`, via
 * `lead.criativo`) e filtrados à janela [windowFrom, windowTo] (strings
 * yyyy-MM-dd, inclusive) — a mesma janela usada para filtrar `leads` neste
 * painel (o filtro de período da página). Se a janela não fizer sentido
 * (ex: período "all"), o chamador deve passar uma janela de 30 dias.
 */
export function computeAdSetQualityMetrics(
  leads: RawLead[],
  movements: RawMovement[],
  sqlStages: Set<string> | string[],
  getCreativeName: (value: string) => string,
  insights: MetaInsightDailyRow[],
  windowFrom: string,
  windowTo: string,
  now: Date = new Date(),
  nlqStages: Set<string> | string[] = [],
  submetidaStages: Set<string> | string[] = [],
  fechoStages: Set<string> | string[] = [],
): AdSetQualityRow[] {
  const sqlStagesSet = sqlStages instanceof Set ? sqlStages : new Set(sqlStages);
  const nlqStagesSet = nlqStages instanceof Set ? nlqStages : new Set(nlqStages);
  const submetidaStagesSet = submetidaStages instanceof Set ? submetidaStages : new Set(submetidaStages);
  const fechoStagesSet = fechoStages instanceof Set ? fechoStages : new Set(fechoStages);

  // Insights filtrados à janela, indexados por ad_id E por ad_name (soma incremental).
  // `lead.criativo` nem sempre é o ad_id numérico do Meta — para os ad sets de
  // Instant Form, a sheet já guarda o nome resolvido do anúncio (ex: "Kauai
  // 75€/semana - Instant Form") em vez do ID. Por isso indexamos os insights
  // pelos dois, e ao resolver cada `id` de `adIds` tentamos ad_id primeiro e
  // caímos para ad_name se não houver correspondência.
  const insightsInWindow = insights.filter(i => i.date >= windowFrom && i.date <= windowTo);
  type InsightAcc = { spend: number; impressions: number; clicks: number; lpViews: number; hasLpData: boolean };
  const byAdId = new Map<string, InsightAcc>();
  const byAdName = new Map<string, InsightAcc>();
  const accumulate = (map: Map<string, InsightAcc>, key: string, i: MetaInsightDailyRow) => {
    let acc = map.get(key);
    if (!acc) {
      acc = { spend: 0, impressions: 0, clicks: 0, lpViews: 0, hasLpData: false };
      map.set(key, acc);
    }
    acc.spend += i.spend ?? 0;
    acc.impressions += i.impressions ?? 0;
    acc.clicks += i.clicks ?? 0;
    if (i.landing_page_views !== null && i.landing_page_views !== undefined) {
      acc.hasLpData = true;
      acc.lpViews += i.landing_page_views;
    }
  };
  for (const i of insightsInWindow) {
    if (i.ad_id) accumulate(byAdId, i.ad_id, i);
    if (i.ad_name) accumulate(byAdName, i.ad_name, i);
  }

  // Agrupar leads por adSet
  const groups = new Map<string, RawLead[]>();
  for (const lead of leads) {
    const adSet = lead.adSet || 'Sem atribuição';
    if (!groups.has(adSet)) groups.set(adSet, []);
    groups.get(adSet)!.push(lead);
  }

  const results: AdSetQualityRow[] = [];

  for (const [adSet, groupLeads] of groups.entries()) {
    const leadNames = new Set(groupLeads.map(l => l.nome).filter(Boolean));

    // Pré-computar quais leads deste grupo já atingiram algum estágio SQL/NLQ/submetida/fecho.
    const reachedSQLNames = new Set<string>();
    const nlqLeads = new Set<string>();
    const submetidaLeads = new Set<string>();
    const fechoLeads = new Set<string>();
    for (const m of movements) {
      if (!leadNames.has(m.nome)) continue;
      const stage = m.stage.trim();
      if (sqlStagesSet.has(stage)) reachedSQLNames.add(m.nome);
      if (nlqStagesSet.has(stage)) nlqLeads.add(m.nome);
      if (submetidaStagesSet.has(stage)) submetidaLeads.add(m.nome);
      if (fechoStagesSet.has(stage)) fechoLeads.add(m.nome);
    }

    // Classificação de maturação:
    // - Se a lead já atingiu SQL → é matura (entra no cálculo), independentemente da idade.
    // - Senão, precisa de >= SQL_MATURATION_DAYS dias para entrar no cálculo (como "não qualificada").
    // - Caso contrário (< N dias E ainda não atingiu SQL) → em maturação, fora do cálculo.
    let leadsMaturas = 0;
    let leadsEmMaturacao = 0;
    const maturasNames = new Set<string>();

    for (const lead of groupLeads) {
      const reachedSQL = lead.nome ? reachedSQLNames.has(lead.nome) : false;
      let dias: number | null = null;
      if (lead.dataRegisto) {
        try {
          dias = differenceInDays(now, parseISO(lead.dataRegisto));
        } catch {
          dias = null;
        }
      }
      const isMatura = reachedSQL || dias === null || dias >= SQL_MATURATION_DAYS;
      if (isMatura) {
        leadsMaturas++;
        if (lead.nome) maturasNames.add(lead.nome);
      } else {
        leadsEmMaturacao++;
      }
    }

    // SQL count = leads maturas que atingiram SQL (por construção, todas as reachedSQL são maturas).
    const sqlLeads = new Set<string>();
    for (const name of reachedSQLNames) {
      if (maturasNames.has(name)) sqlLeads.add(name);
    }
    const totalSQLs = sqlLeads.size;
    // sqlImaturoCount fica 0 por construção (uma lead que atingiu SQL é sempre matura agora),
    // mas mantemos o campo para compatibilidade com o tipo/UI.
    const sqlImaturoCount = 0;
    const nlqCount = nlqLeads.size;
    const submetidas = submetidaLeads.size;
    const fechos = fechoLeads.size;

    const taxaSQL = leadsMaturas > 0 ? totalSQLs / leadsMaturas : null;
    const taxaNLQ = groupLeads.length > 0 ? nlqCount / groupLeads.length : null;


    // Criativos associados (resolvidos), para contexto/secondary column
    const criativoLabels = new Set<string>();
    const adIds = new Set<string>();
    for (const lead of groupLeads) {
      if (lead.criativo) {
        criativoLabels.add(getCreativeName(lead.criativo));
        adIds.add(lead.criativo);
      }
    }

    // Somar spend/impressions/clicks/LP-views reais de meta_insights_daily pelos
    // ad_ids deste ad set, na janela [windowFrom, windowTo].
    let gasto: number | null = null;
    let impressions: number | null = null;
    let clicks: number | null = null;
    let landingPageViews: number | null = null;
    let hasAnyInsight = false;
    let hasAnyLpData = false;
    for (const id of adIds) {
      const acc = byAdId.get(id) ?? byAdName.get(id) ?? byAdName.get(getCreativeName(id));
      if (!acc) continue;
      hasAnyInsight = true;
      gasto = (gasto ?? 0) + acc.spend;
      impressions = (impressions ?? 0) + acc.impressions;
      clicks = (clicks ?? 0) + acc.clicks;
      if (acc.hasLpData) {
        hasAnyLpData = true;
        landingPageViews = (landingPageViews ?? 0) + acc.lpViews;
      }
    }
    if (!hasAnyInsight) {
      gasto = null;
      impressions = null;
      clicks = null;
    }
    if (!hasAnyLpData) {
      landingPageViews = null;
    }

    const custoPorSQL = gasto !== null && totalSQLs > 0 ? gasto / totalSQLs : null;
    const taxaLPParaLead = landingPageViews !== null && landingPageViews > 0
      ? groupLeads.length / landingPageViews
      : null;
    const custoPorLead = gasto !== null && groupLeads.length > 0 ? gasto / groupLeads.length : null;
    const custoPorNLQ = gasto !== null && nlqCount > 0 ? gasto / nlqCount : null;
    const custoPorSubmetida = gasto !== null && submetidas > 0 ? gasto / submetidas : null;
    const custoPorFecho = gasto !== null && fechos > 0 ? gasto / fechos : null;

    results.push({
      adSet,
      criativos: Array.from(criativoLabels),
      totalLeads: groupLeads.length,
      leadsMaturas,
      leadsEmMaturacao,
      totalSQLs,
      sqlImaturoCount,
      taxaSQL,
      gasto,
      custoPorSQL,
      impressions,
      clicks,
      landingPageViews,
      taxaLPParaLead,
      custoPorLead,
      nlqCount,
      taxaNLQ,
      custoPorNLQ,
      submetidas,
      custoPorSubmetida,
      fechos,
      custoPorFecho,
    });
  }

  // Sort by custo por SQL ascending (melhor primeiro), nulls (sem SQL ainda) por último —
  // mirroring the fallback sort in creativeQuality.ts (taxaSQLFecho -> taxaLeadSQL).
  results.sort((a, b) => {
    if (a.custoPorSQL === null && b.custoPorSQL === null) {
      return (b.taxaSQL ?? -1) - (a.taxaSQL ?? -1);
    }
    if (a.custoPorSQL === null) return 1;
    if (b.custoPorSQL === null) return -1;
    if (a.custoPorSQL !== b.custoPorSQL) {
      return a.custoPorSQL - b.custoPorSQL;
    }
    return (b.taxaSQL ?? -1) - (a.taxaSQL ?? -1);
  });

  return results;
}
