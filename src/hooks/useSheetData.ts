import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSourceMapping, getTipo } from '@/hooks/useSourceMapping';
import type { SourceMapping } from '@/types/dashboard';
import type {
  FilterState, Driver, InvestmentEntry,
  SheetData, KPIData, MonthlyClosings, MonthlyClosingDetail,
  SourceDistribution, CACBreakdown, ChurnBreakdown, LTVBreakdown, MonthlyRevenue,
  InvestmentBreakdown,
} from '@/types/dashboard';

// --- Date utilities ---

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleaned.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const euMatch = cleaned.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (euMatch) {
    const d = new Date(parseInt(euMatch[3]), parseInt(euMatch[2]) - 1, parseInt(euMatch[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function isWithinPeriod(date: Date, period: string): boolean {
  if (period === 'all') return true;
  const now = new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  switch (period) {
    case '7d': return diffDays <= 7;
    case '30d': return diffDays <= 30;
    case '90d': return diffDays <= 90;
    case '12m': return diffDays <= 365;
    default: return true;
  }
}

function formatMonthKey(key: string): string {
  const [year, month] = key.split('-');
  const monthIdx = parseInt(month) - 1;
  return `${PT_MONTHS[monthIdx] || month} ${year.slice(2)}`;
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// --- Data fetching ---

interface RawSheetData {
  drivers: Driver[];
  investmentEntries: InvestmentEntry[];
  fontes: string[];
}

async function fetchSheetData(): Promise<RawSheetData> {
  const { data, error } = await supabase.functions.invoke('fetch-sheets-data');
  if (error) throw new Error(error.message || 'Erro ao carregar dados da sheet');
  if (data?.error) throw new Error(data.error);
  return data as RawSheetData;
}

// --- Offer-to-campaign mapping ---

const OFFER_CAMPAIGN_MAP: Record<string, string[]> = {
  slot: ['Slot', 'Funil Slot'],
  aluguer: ['Aluguer TVDE', 'Aluguer TVDE + Tours', 'Funil Aluguer TVDE', 'Funil Aluguer TVDE + Tours'],
  compra: ['Venda', 'Funil Venda'],
};

const GENERAL_CAMPAIGNS = ['Comercial'];

// --- Data computation ---

function buildFirstConversionSet(drivers: Driver[]): Set<string> {
  // Group by id, find earliest dataFecho per id → that entry is the "acquisition"
  const earliestByID = new Map<string, { dataFecho: Date; index: number }>();
  drivers.forEach((d, idx) => {
    if (!d.id || !d.dataFecho) return;
    const date = parseDate(d.dataFecho);
    if (!date) return;
    const existing = earliestByID.get(d.id);
    if (!existing || date < existing.dataFecho) {
      earliestByID.set(d.id, { dataFecho: date, index: idx });
    }
  });
  // Build a set of "id|dataFecho" keys for first conversions
  const firstConversions = new Set<string>();
  earliestByID.forEach(({ index }) => {
    const d = drivers[index];
    firstConversions.add(`${d.id}|${d.dataFecho}`);
  });
  return firstConversions;
}

function isFirstConversion(d: Driver, firstConversions: Set<string>): boolean {
  return firstConversions.has(`${d.id}|${d.dataFecho}`);
}

function prorateInvestment(
  entries: InvestmentEntry[],
  rangeFrom: Date,
  rangeTo: Date,
): InvestmentEntry[] {
  return entries.flatMap((e) => {
    const entryStart = e.dataInicio ? parseDate(e.dataInicio) : parseDate(`${e.mes}-01`);
    const entryEnd = e.dataFim ? parseDate(e.dataFim) : (() => {
      const [y, m] = e.mes.split('-').map(Number);
      return new Date(y, m, 0);
    })();
    if (!entryStart || !entryEnd) return [];
    if (entryEnd < rangeFrom || entryStart > rangeTo) return [];
    const overlapStart = entryStart > rangeFrom ? entryStart : rangeFrom;
    const overlapEnd = entryEnd < rangeTo ? entryEnd : rangeTo;
    const dayMs = 86400000;
    const totalDays = Math.floor((entryEnd.getTime() - entryStart.getTime()) / dayMs) + 1;
    const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / dayMs) + 1;
    if (totalDays <= 0 || overlapDays <= 0) return [];
    const ratio = Math.min(1, overlapDays / totalDays);
    return [{ ...e, valor: e.valor * ratio }];
  });
}

function computeData(raw: RawSheetData, filters: FilterState, sourceMappings: SourceMapping[]): SheetData {
  const firstConversions = buildFirstConversionSet(raw.drivers);
  let filtered = raw.drivers;

  // Period filter helper — reused for drivers and for FB ratio calculation
  const isDriverInPeriod = (d: Driver): boolean => {
    const date = parseDate(d.dataFecho) || parseDate(d.dataLead);
    if (!date) return false;
    if (filters.period === 'month' && filters.selectedMonth) {
      return toMonthKey(date) === filters.selectedMonth;
    }
    if (filters.period === 'custom' && filters.customDateFrom && filters.customDateTo) {
      const from = new Date(filters.customDateFrom);
      const to = new Date(filters.customDateTo);
      to.setHours(23, 59, 59, 999);
      return date >= from && date <= to;
    }
    if (filters.period !== 'all' && filters.period !== 'custom' && filters.period !== 'month') {
      return isWithinPeriod(date, filters.period);
    }
    return true;
  };

  // Period filter
  filtered = filtered.filter(isDriverInPeriod);

  // Offer type filter (multi-select: empty array = all)
  if (filters.offerTypes.length > 0) {
    filtered = filtered.filter(d => filters.offerTypes.includes(d.tipoOferta as any));
  }

  // Source filter
  if (filters.source !== 'todos') {
    filtered = filtered.filter(d => d.fonte === filters.source);
  }

  // KPIs
  const totalDrivers = filtered.length;
  const churned = filtered.filter(d => d.dataSaida).length;
  const tickets = filtered.filter(d => d.ticket !== null && d.ticket > 0).map(d => d.ticket!);

  // Investment filtered by source
  let filteredInvestment = raw.investmentEntries;
  const isPaidSource = filters.source === 'todos' || getTipo(filters.source, sourceMappings) === 'Paid Media';
  if (!isPaidSource) {
    filteredInvestment = [];
  }

  // Period filter for investment — pro-rata by overlap days for ranges
  if (filters.period === 'month' && filters.selectedMonth) {
    filteredInvestment = filteredInvestment.filter(e => e.mes === filters.selectedMonth);
  } else if (filters.period === 'custom' && filters.customDateFrom && filters.customDateTo) {
    const from = new Date(filters.customDateFrom);
    const to = new Date(filters.customDateTo);
    to.setHours(23, 59, 59, 999);
    filteredInvestment = prorateInvestment(filteredInvestment, from, to);
  } else if (filters.period !== 'all' && filters.period !== 'custom' && filters.period !== 'month') {
    const days = filters.period === '7d' ? 7
      : filters.period === '30d' ? 30
      : filters.period === '90d' ? 90
      : filters.period === '12m' ? 365
      : 0;
    if (days > 0) {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date(to.getTime() - days * 86400000);
      from.setHours(0, 0, 0, 0);
      filteredInvestment = prorateInvestment(filteredInvestment, from, to);
    }
  }

  // Investment filtered by offer type with proportional Comercial allocation
  let investimentoTotal: number;
  let cacBreakdownData: CACBreakdown;

  // Common values for breakdown
  const comercialEntries = filteredInvestment.filter(e => e.campanha === 'Comercial');
  const comercialTotal = comercialEntries.reduce((s, e) => s + e.valor, 0);
  const allDriversPeriodFB = raw.drivers
    .filter(isDriverInPeriod)
    .filter(d => filters.source === 'todos' || d.fonte === filters.source)
    .filter(d => getTipo(d.fonte, sourceMappings) === 'Paid Media');
  const totalDriversFBAll = allDriversPeriodFB.length;

  // Referral cost calculation
  const REFERRAL_COST_SLOT_ALUGUER = 75;
  const REFERRAL_COST_COMPRA = 200;

  const getReferralCost = (d: Driver): number =>
    d.tipoOferta === 'compra' ? REFERRAL_COST_COMPRA : REFERRAL_COST_SLOT_ALUGUER;

  // All referral first-conversions in period (respecting source filter)
  const allDriversPeriodRef = raw.drivers
    .filter(isDriverInPeriod)
    .filter(d => filters.source === 'todos' || d.fonte === filters.source)
    .filter(d => getTipo(d.fonte, sourceMappings) === 'Orgânico');

  if (filters.offerTypes.length > 0) {
    const offerCampaigns = filters.offerTypes.flatMap(t => OFFER_CAMPAIGN_MAP[t] || []);
    const offerAds = filteredInvestment.filter(e => offerCampaigns.includes(e.campanha));
    const adsTotal = offerAds.reduce((s, e) => s + e.valor, 0);

    const offerDriversFB = allDriversPeriodFB.filter(d => filters.offerTypes.includes(d.tipoOferta as any));
    const ratio = totalDriversFBAll > 0 ? offerDriversFB.length / totalDriversFBAll : 0;
    const comercialProporcional = comercialTotal * ratio;

    // Referrals for selected offers
    const offerRefDrivers = allDriversPeriodRef
      .filter(d => filters.offerTypes.includes(d.tipoOferta as any))
      .filter(d => isFirstConversion(d, firstConversions));
    const referenciasTotal = offerRefDrivers.reduce((sum, d) => sum + getReferralCost(d), 0);

    investimentoTotal = adsTotal + comercialProporcional + referenciasTotal;

    const adsByCampaign = new Map<string, number>();
    offerAds.forEach(e => adsByCampaign.set(e.campanha, (adsByCampaign.get(e.campanha) || 0) + e.valor));

    const fbFirstConversions = filtered.filter(d => getTipo(d.fonte, sourceMappings) === 'Paid Media' && isFirstConversion(d, firstConversions)).length;
    const paidDriversCount = fbFirstConversions + offerRefDrivers.length;

    const offerLabel = filters.offerTypes.join(', ');
    cacBreakdownData = {
      adsCampaigns: Array.from(adsByCampaign.entries()).map(([campanha, valor]) => ({ campanha, valor })),
      adsTotal,
      comercialTotal,
      comercialProporcional,
      ratioFB: ratio,
      conversoesFBOferta: offerDriversFB.length,
      conversoesFBTotal: totalDriversFBAll,
      referenciasCount: offerRefDrivers.length,
      referenciaCustoUnitario: null,
      referenciasTotal,
      investimentoTotal,
      paidDrivers: paidDriversCount,
      cacMedio: paidDriversCount > 0 ? investimentoTotal / paidDriversCount : 0,
      formulaDescricao: `(Ads ${offerLabel} + Comercial × ${offerDriversFB.length}/${totalDriversFBAll} + Referências) ÷ ${paidDriversCount} primeiras conversões (FB + Ref)`,
    };
  } else {
    // Referrals across all offers
    const allRefFirstConversions = allDriversPeriodRef.filter(d => isFirstConversion(d, firstConversions));
    const referenciasTotal = allRefFirstConversions.reduce((sum, d) => sum + getReferralCost(d), 0);

    const baseInvestment = filteredInvestment.reduce((s, e) => s + e.valor, 0);
    investimentoTotal = baseInvestment + referenciasTotal;

    const nonGeneral = filteredInvestment.filter(e => !GENERAL_CAMPAIGNS.includes(e.campanha));
    const adsByCampaign = new Map<string, number>();
    nonGeneral.forEach(e => adsByCampaign.set(e.campanha, (adsByCampaign.get(e.campanha) || 0) + e.valor));
    const adsTotal = nonGeneral.reduce((s, e) => s + e.valor, 0);

    const fbFirstConversions = filtered.filter(d => getTipo(d.fonte, sourceMappings) === 'Paid Media' && isFirstConversion(d, firstConversions)).length;
    const paidDriversCount = fbFirstConversions + allRefFirstConversions.length;

    cacBreakdownData = {
      adsCampaigns: Array.from(adsByCampaign.entries()).map(([campanha, valor]) => ({ campanha, valor })),
      adsTotal,
      comercialProporcional: null,
      ratioFB: null,
      conversoesFBOferta: fbFirstConversions,
      conversoesFBTotal: totalDriversFBAll,
      referenciasCount: allRefFirstConversions.length,
      referenciaCustoUnitario: null,
      referenciasTotal,
      investimentoTotal,
      paidDrivers: paidDriversCount,
      cacMedio: paidDriversCount > 0 ? investimentoTotal / paidDriversCount : 0,
      comercialTotal,
      formulaDescricao: `(Ads total + Comercial + Referências) ÷ ${paidDriversCount} primeiras conversões (FB + Ref)`,
    };
  }

  const fbPaidDrivers = filtered.filter(d => getTipo(d.fonte, sourceMappings) === 'Paid Media' && isFirstConversion(d, firstConversions)).length;
  const refPaidDrivers = filtered.filter(d => getTipo(d.fonte, sourceMappings) === 'Orgânico' && isFirstConversion(d, firstConversions)).length;
  const paidDrivers = fbPaidDrivers + refPaidDrivers;
  const cacMedio = paidDrivers > 0 ? investimentoTotal / paidDrivers : 0;

  // Sales cycle
  const ciclos = filtered
    .filter(d => d.dataFecho && d.dataLead)
    .map(d => {
      const fecho = parseDate(d.dataFecho!);
      const lead = parseDate(d.dataLead!);
      if (fecho && lead) {
        return Math.abs(fecho.getTime() - lead.getTime()) / (1000 * 60 * 60 * 24);
      }
      return null;
    })
    .filter((v): v is number => v !== null);

  const cicloVendaMedio = ciclos.length > 0 ? ciclos.reduce((s, c) => s + c, 0) / ciclos.length : 0;
  const taxaChurn = totalDrivers > 0 ? (churned / totalDrivers) * 100 : 0;
  const ticketMedio = tickets.length > 0 ? tickets.reduce((s, t) => s + t, 0) / tickets.length : 0;

  // LTV: ticket mensal * meses ativos (por driver)
  // Para aluguer, o ticket na sheet é semanal → multiplicar por 4
  const getTicketMensal = (d: Driver): number => {
    const base = d.ticket!;
    return d.tipoOferta === 'aluguer' ? base * 4 : base;
  };

  const now = new Date();
  const ltvValues = filtered
    .filter(d => d.ticket !== null && d.ticket > 0 && d.dataFecho)
    .map(d => {
      const start = parseDate(d.dataFecho!);
      if (!start) return null;
      const end = d.dataSaida ? parseDate(d.dataSaida) || now : now;
      const mesesAtivos = d.tipoOferta === 'compra' ? 1 : Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      return getTicketMensal(d) * mesesAtivos;
    })
    .filter((v): v is number => v !== null);
  const ltv = ltvValues.length > 0 ? ltvValues.reduce((s, v) => s + v, 0) / ltvValues.length : 0;

  // LTV Breakdown
  const ltvDriversList = filtered
    .filter(d => d.ticket !== null && d.ticket > 0 && d.dataFecho)
    .map(d => {
      const start = parseDate(d.dataFecho!);
      if (!start) return null;
      const end = d.dataSaida ? parseDate(d.dataSaida) || now : now;
      const mesesAtivos = d.tipoOferta === 'compra' ? 1 : Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      const ticketMensal = getTicketMensal(d);
      return {
        nome: d.nome,
        ticket: ticketMensal,
        dataFecho: d.dataFecho!,
        dataSaida: d.dataSaida,
        mesesAtivos,
        ltvIndividual: ticketMensal * mesesAtivos,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const somaLTV = ltvDriversList.reduce((s, d) => s + d.ltvIndividual, 0);
  const ltvBreakdownData: LTVBreakdown = {
    driversCount: ltvDriversList.length,
    ltvMedio: ltv,
    somaLTV,
    driversList: ltvDriversList,
    formulaDescricao: `Soma dos LTVs individuais (€${somaLTV.toLocaleString()}) / ${ltvDriversList.length} drivers`,
  };

  const kpis: KPIData = {
    totalDrivers,
    investimentoTotal,
    cacMedio,
    cicloVendaMedio,
    taxaChurn,
    ticketMedio,
    ltv,
  };

  // Monthly closings + churns
  const closingsByMonth = new Map<string, number>();
  const churnsByMonth = new Map<string, number>();
  filtered.forEach(d => {
    if (d.dataFecho) {
      const date = parseDate(d.dataFecho);
      if (date) {
        const key = toMonthKey(date);
        closingsByMonth.set(key, (closingsByMonth.get(key) || 0) + 1);
      }
    }
    if (d.dataSaida) {
      const date = parseDate(d.dataSaida);
      if (date) {
        const key = toMonthKey(date);
        churnsByMonth.set(key, (churnsByMonth.get(key) || 0) + 1);
      }
    }
  });
  const allMonthKeys = new Set([...closingsByMonth.keys(), ...churnsByMonth.keys()]);
  const monthlyClosings: MonthlyClosings[] = Array.from(allMonthKeys)
    .sort((a, b) => a.localeCompare(b))
    .map(month => ({
      month,
      label: formatMonthKey(month),
      count: closingsByMonth.get(month) || 0,
      churns: churnsByMonth.get(month) || 0,
    }));

  // Monthly closing details
  const monthlyDrivers = new Map<string, Driver[]>();
  filtered.forEach(d => {
    if (d.dataFecho) {
      const date = parseDate(d.dataFecho);
      if (date) {
        const key = toMonthKey(date);
        const arr = monthlyDrivers.get(key) || [];
        arr.push(d);
        monthlyDrivers.set(key, arr);
      }
    }
  });

  const monthlyClosingDetails: MonthlyClosingDetail[] = Array.from(monthlyDrivers.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, drivers]) => {
      const offerCounts = new Map<string, number>();
      const sourceCounts2 = new Map<string, number>();
      const tickets2: number[] = [];

      drivers.forEach(d => {
        if (d.tipoOferta) offerCounts.set(d.tipoOferta, (offerCounts.get(d.tipoOferta) || 0) + 1);
        if (d.fonte) sourceCounts2.set(d.fonte, (sourceCounts2.get(d.fonte) || 0) + 1);
        if (d.ticket != null && d.ticket > 0) tickets2.push(d.ticket);
      });

      return {
        month,
        label: formatMonthKey(month),
        totalCount: drivers.length,
        byOffer: Array.from(offerCounts.entries()).map(([offer, count]) => ({ offer, count })),
        bySource: Array.from(sourceCounts2.entries()).map(([source, count]) => ({ source, count })),
        avgTicket: tickets2.length > 0 ? tickets2.reduce((s, t) => s + t, 0) / tickets2.length : 0,
        drivers: drivers.map(d => ({ nome: d.nome, tipoOferta: d.tipoOferta, ticket: d.ticket, fonte: d.fonte })),
      };
    });

  // Source distribution
  const sourceCounts = new Map<string, number>();
  filtered.forEach(d => {
    if (d.fonte) {
      sourceCounts.set(d.fonte, (sourceCounts.get(d.fonte) || 0) + 1);
    }
  });
  const sourceDistribution: SourceDistribution[] = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({
      source,
      count,
      percentage: totalDrivers > 0 ? Math.round((count / totalDrivers) * 100) : 0,
    }));

  // Churn breakdown
  const churnedList = filtered
    .filter(d => d.dataSaida)
    .map(d => ({
      nome: d.nome,
      tipoOferta: d.tipoOferta,
      fonte: d.fonte,
      dataSaida: d.dataSaida!,
    }));

  const churnBreakdownData: ChurnBreakdown = {
    totalDrivers,
    churnedDrivers: churned,
    taxaChurn,
    churnedList,
    formulaDescricao: `${churned} saídas / ${totalDrivers} total = ${taxaChurn.toFixed(1)}%`,
  };

  // Monthly revenue estimation
  const allDriversWithFecho = filtered.filter(d => d.ticket !== null && d.ticket > 0 && d.dataFecho);
  const fechoDates = allDriversWithFecho.map(d => parseDate(d.dataFecho!)).filter((v): v is Date => v !== null);
  
  let monthlyRevenue: MonthlyRevenue[] = [];
  if (fechoDates.length > 0) {
    const minDate = new Date(Math.min(...fechoDates.map(d => d.getTime())));
    const startMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const cursor = new Date(startMonth);
    while (cursor <= endMonth) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); // last day of month
      
      const key = toMonthKey(cursor);
      
      const activeDrivers = allDriversWithFecho.filter(d => {
        const fecho = parseDate(d.dataFecho!);
        if (!fecho || fecho > monthEnd) return false;
        if (d.tipoOferta === 'compra') return toMonthKey(fecho) === key;
        const saida = d.dataSaida ? parseDate(d.dataSaida) : null;
        if (saida && saida < monthStart) return false;
        return true;
      });
      
      const revenue = activeDrivers.reduce((sum, d) => sum + getTicketMensal(d), 0);
      
      monthlyRevenue.push({
        month: key,
        label: formatMonthKey(key),
        revenue,
        activeDrivers: activeDrivers.length,
      });
      
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const investmentBreakdown: InvestmentBreakdown = {
    adsCampaigns: cacBreakdownData.adsCampaigns,
    adsTotal: cacBreakdownData.adsTotal,
    comercialTotal: cacBreakdownData.comercialTotal,
    comercialProporcional: cacBreakdownData.comercialProporcional,
    ratioFB: cacBreakdownData.ratioFB,
    conversoesFBOferta: cacBreakdownData.conversoesFBOferta,
    conversoesFBTotal: cacBreakdownData.conversoesFBTotal,
    referenciasCount: cacBreakdownData.referenciasCount,
    referenciaCustoUnitario: cacBreakdownData.referenciaCustoUnitario,
    referenciasTotal: cacBreakdownData.referenciasTotal,
    total: investimentoTotal,
  };

  // Conversões (Lead → Fecho)
  const conversoes = filtered
    .filter(d => d.dataFecho)
    .map(d => ({
      id: d.id,
      nome: d.nome,
      ticket: d.ticket,
      dataRegisto: d.dataLead,
      dataFecho: d.dataFecho,
      fonte: d.fonte,
      criativo: d.criativo || 'Sem atribuição',
    }))
    .sort((a, b) => {
      const dateA = a.dataRegisto ? new Date(a.dataRegisto).getTime() : 0;
      const dateB = b.dataRegisto ? new Date(b.dataRegisto).getTime() : 0;
      return dateB - dateA; // DESC
    });

  const conversaoBreakdown = {
    conversoes,
    totalConversoes: conversoes.length,
    ticketMedio: conversoes.length > 0
      ? conversoes.reduce((s, c) => s + (c.ticket || 0), 0) / conversoes.length
      : 0,
  };

  return {
    kpis,
    drivers: filtered,
    monthlyClosings,
    monthlyClosingDetails,
    sourceDistribution,
    fontes: raw.fontes,
    cacBreakdown: cacBreakdownData,
    churnBreakdown: churnBreakdownData,
    ltvBreakdown: ltvBreakdownData,
    monthlyRevenue,
    investmentBreakdown,
    conversaoBreakdown,
  };
}

// --- Hook ---

export function useSheetData(filters: FilterState) {
  const { data: sourceMappings } = useSourceMapping();

  const query = useQuery({
    queryKey: ['sheet-data'],
    queryFn: fetchSheetData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const data = useMemo(() => {
    if (!query.data) return null;
    return computeData(query.data, filters, sourceMappings);
  }, [query.data, filters, sourceMappings]);

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRefreshData() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['sheet-data'] });
}
