export type OfferType = 'slot' | 'aluguer' | 'compra';
export type PeriodFilter = '7d' | '30d' | '90d' | '12m' | 'all' | 'custom' | 'month';

export interface Driver {
  id: string;
  nome: string;
  fonte: string;
  tipoOferta: string;
  ticket: number | null;
  dataFecho: string | null;
  dataLead: string | null;
  dataSaida: string | null;
  motivoPerda: string | null;
  observacoes: string | null;
  criativo?: string | null;
}

export interface Conversao {
  id: string;
  nome: string;
  ticket: number | null;
  dataRegisto: string | null;
  dataFecho: string | null;
  fonte: string;
  criativo: string;
}

export interface ConversaoBreakdown {
  conversoes: Conversao[];
  totalConversoes: number;
  ticketMedio: number;
}

export interface InvestmentEntry {
  mes: string;
  campanha: string;
  valor: number;
  dataInicio?: string;
  dataFim?: string;
}

export interface KPIData {
  totalDrivers: number;
  investimentoTotal: number;
  cacMedio: number;
  cicloVendaMedio: number;
  taxaChurn: number;
  ticketMedio: number;
  ltv: number;
}

export interface MonthlyClosings {
  month: string;
  label: string;
  count: number;
  churns: number;
}

export interface CampaignCAC {
  campanha: string;
  investimento: number;
  fechos: number;
  cac: number;
}

export interface MonthlyClosingDetail {
  month: string;
  label: string;
  totalCount: number;
  byOffer: { offer: string; count: number }[];
  bySource: { source: string; count: number }[];
  avgTicket: number;
  drivers: { nome: string; tipoOferta: string; ticket: number | null; fonte: string }[];
}

export interface SourceDistribution {
  source: string;
  count: number;
  percentage: number;
}

export interface CACBreakdown {
  adsCampaigns: { campanha: string; valor: number }[];
  adsTotal: number;
  comercialTotal: number;
  comercialProporcional: number | null;
  ratioFB: number | null;
  conversoesFBOferta: number;
  conversoesFBTotal: number;
  referenciasCount: number;
  referenciaCustoUnitario: number | null;
  referenciasTotal: number;
  investimentoTotal: number;
  paidDrivers: number;
  cacMedio: number;
  formulaDescricao: string;
}

export interface ChurnBreakdown {
  totalDrivers: number;
  churnedDrivers: number;
  taxaChurn: number;
  churnedList: { nome: string; tipoOferta: string; fonte: string; dataSaida: string }[];
  formulaDescricao: string;
}

export interface LTVDriverDetail {
  nome: string;
  ticket: number;
  dataFecho: string;
  dataSaida: string | null;
  mesesAtivos: number;
  ltvIndividual: number;
}

export interface LTVBreakdown {
  driversCount: number;
  ltvMedio: number;
  somaLTV: number;
  driversList: LTVDriverDetail[];
  formulaDescricao: string;
}

export interface InvestmentBreakdown {
  adsCampaigns: { campanha: string; valor: number }[];
  adsTotal: number;
  comercialTotal: number;
  comercialProporcional: number | null;
  ratioFB: number | null;
  conversoesFBOferta: number;
  conversoesFBTotal: number;
  referenciasCount: number;
  referenciaCustoUnitario: number | null;
  referenciasTotal: number;
  total: number;
}

export interface MonthlyRevenue {
  month: string;
  label: string;
  revenue: number;
  activeDrivers: number;
}

export interface SheetData {
  kpis: KPIData;
  drivers: Driver[];
  monthlyClosings: MonthlyClosings[];
  monthlyClosingDetails: MonthlyClosingDetail[];
  sourceDistribution: SourceDistribution[];
  fontes: string[];
  cacBreakdown: CACBreakdown;
  churnBreakdown: ChurnBreakdown;
  ltvBreakdown: LTVBreakdown;
  monthlyRevenue: MonthlyRevenue[];
  investmentBreakdown: InvestmentBreakdown;
  conversaoBreakdown: ConversaoBreakdown;
}

export interface FilterState {
  period: PeriodFilter;
  offerTypes: OfferType[];
  source: string;
  customDateFrom?: string;
  customDateTo?: string;
  selectedMonth?: string;
}

// --- GoHighLevel types ---

export interface GHLStage {
  id: string;
  name: string;
  position: number;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLStage[];
}

export interface GHLStageMetric {
  pipelineId: string;
  stageId: string;
  stageName: string;
  count: number;
  monetaryValue: number;
}

export interface GHLEnrichedOpportunity {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stageName: string;
  pipelineName: string;
  monetaryValue: number;
  status: string;
}

export interface GHLNote {
  id: string;
  body: string;
  dateAdded?: string;
}

export interface GHLFunnelData {
  pipelines: GHLPipeline[];
  stageMetrics: GHLStageMetric[];
  opportunities: GHLEnrichedOpportunity[];
}

export interface GHLConversionRate {
  fromStage: string;
  toStage: string;
  rate: number;
}

export interface PipelineStageConfig {
  id: string;
  pipeline_name: string;
  stage_key: string;
  stage_label: string;
  position: number;
  rule_type: 'match_stages' | 'contacted' | 'reached_any';
  rule_params: Record<string, unknown>;
  created_at?: string;
}

export interface GHLFunnelMetric {
  stageName: string;
  currentCount: number;
  cumulativeReached: number;
  conversionFromBase: number;
  monetaryValue: number;
}

// --- Marketing (RAW_LEADS) types ---

export interface RawLead {
  id: string;
  nome: string;
  oferta: string;
  subcategoria: string;
  dataRegisto: string | null;
  fonte: string;
  landingPage: string;
  campanha: string;
  adSet: string;
  criativo: string;
}

export interface SourceMapping {
  id: string;
  fonteCRM: string;
  canalDashboard: string;
  tipo: 'Paid Media' | 'Orgânico';
}

export interface FunnelVisualConfig {
  id: string;
  pipeline: string;
  stage: string;
  ordem: number;
  visivel: boolean;
  aliases: string[];
}

export type MarketingPeriod = 'week' | 'last_week' | 'month' | '30d' | '90d' | 'all' | 'custom';

export interface MonthlyObjective {
  id: string;
  mes: string;
  oferta: string;
  revenueAlvo: number;
  fechosAlvo: number;
  sqlsAlvo: number;
  leadsAlvo: number;
  budgetAlvo: number;
  preAprovacaoAlvo: number;
}

export interface MarketingFilterState {
  period: MarketingPeriod;
  oferta: string; // 'all' or specific value
}
