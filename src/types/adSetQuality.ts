export interface AdSetQualityRow {
  /** Ad set label (RawLead.adSet), or 'Sem atribuição'. */
  adSet: string;
  /** Criativo(s) associados a este ad set (nomes já resolvidos), para contexto. */
  criativos: string[];
  totalLeads: number;
  /** Leads com dataRegisto há >= SQL_MATURATION_DAYS dias (entram no cálculo de taxa/custo). */
  leadsMaturas: number;
  /** Leads com dataRegisto há < SQL_MATURATION_DAYS dias (excluídas do cálculo, mostradas à parte). */
  leadsEmMaturacao: number;
  /** SQLs contabilizados apenas entre as leads maturas. */
  totalSQLs: number;
  /** Leads AINDA imaturas (< SQL_MATURATION_DAYS dias) que já atingiram um estágio SQL. Não entram no cálculo de taxa/custo. */
  sqlImaturoCount: number;
  /** SQLs ÷ leads maturas (null se não houver leads maturas). */
  taxaSQL: number | null;
  /** Gasto real (soma de meta_insights_daily.spend) na janela usada por este painel, ou null se desconhecido. */
  gasto: number | null;
  /** Gasto ÷ SQLs, ou null se não houver gasto ou SQLs. */
  custoPorSQL: number | null;
  /** Impressões somadas (meta_insights_daily) na mesma janela, ou null se desconhecido. */
  impressions: number | null;
  /** Cliques somados (meta_insights_daily) na mesma janela, ou null se desconhecido. */
  clicks: number | null;
  /** Visualizações de landing page somadas na mesma janela. null quando não há dados (ex: ad set só com Instant Form, sem LP). */
  landingPageViews: number | null;
  /** landingPageViews > 0 ? totalSQLs-source-leads / landingPageViews : null — taxa LP → Lead (usa leadsMaturas+leadsEmMaturacao, i.e. totalLeads, como numerador). */
  taxaLPParaLead: number | null;
  /** Custo ÷ Leads (totalLeads), ou null se não houver gasto ou leads. */
  custoPorLead: number | null;
  /** Contagem de leads (de totalLeads, SEM janela de maturação) cujo histórico atingiu NLQ ou além. */
  nlqCount: number;
  /** nlqCount ÷ totalLeads, ou null se totalLeads = 0. */
  taxaNLQ: number | null;
  /** Gasto ÷ nlqCount, ou null se não houver gasto ou NLQs. */
  custoPorNLQ: number | null;
  /** Contagem de leads (SEM janela de maturação) com stage "Pré Aprovação Submetida". */
  submetidas: number;
  /** Gasto ÷ submetidas, ou null se não houver gasto ou submetidas. */
  custoPorSubmetida: number | null;
  /** Contagem de leads (SEM janela de maturação) com stage "Fechado". */
  fechos: number;
  /** Gasto ÷ fechos, ou null se não houver gasto ou fechos. */
  custoPorFecho: number | null;
}
