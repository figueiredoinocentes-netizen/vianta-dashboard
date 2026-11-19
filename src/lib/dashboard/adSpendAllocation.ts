import type { InvestmentEntry } from '@/types/dashboard';

const GENERAL_CAMPAIGNS = ['Comercial'];

/**
 * Split Meta spend into offer-specific campaigns and campaigns shared across
 * offers. Shared campaigns (e.g. the generic TVDE campaign) are allocated by
 * the selected offer's share of paid-media drivers, not silently discarded.
 */
export function allocateOfferAdSpend(
  entries: InvestmentEntry[],
  offerCampaigns: string[],
  offerRatio: number,
): { adsTotal: number; adsCampaigns: { campanha: string; valor: number }[] } {
  const mapped = entries.filter(e => offerCampaigns.includes(e.campanha));
  const shared = entries.filter(e =>
    !offerCampaigns.includes(e.campanha) && !GENERAL_CAMPAIGNS.includes(e.campanha),
  );
  const adsTotal = mapped.reduce((sum, e) => sum + e.valor, 0)
    + shared.reduce((sum, e) => sum + e.valor, 0) * offerRatio;

  const byCampaign = new Map<string, number>();
  mapped.forEach(e => byCampaign.set(e.campanha, (byCampaign.get(e.campanha) || 0) + e.valor));
  if (shared.length && offerRatio > 0) {
    const sharedAllocated = shared.reduce((sum, e) => sum + e.valor, 0) * offerRatio;
    byCampaign.set('Meta Ads partilhado (alocado por proporção de leads)', sharedAllocated);
  }

  return {
    adsTotal,
    adsCampaigns: Array.from(byCampaign.entries()).map(([campanha, valor]) => ({ campanha, valor })),
  };
}
