import { describe, expect, it } from 'vitest';
import { allocateOfferAdSpend } from '@/lib/dashboard/adSpendAllocation';
import type { InvestmentEntry } from '@/types/dashboard';

const entry = (campanha: string, valor: number): InvestmentEntry => ({ mes: '2026-11', campanha, valor });

describe('allocateOfferAdSpend', () => {
  it('allocates shared Meta campaign spend by the selected offer share instead of dropping it', () => {
    const result = allocateOfferAdSpend(
      [entry('[Lead Gen] [TVDE Drivers]', 100), entry('Venda', 50)],
      ['Venda', 'Funil Venda'],
      0.4,
    );

    expect(result.adsTotal).toBe(90);
    expect(result.adsCampaigns).toEqual([
      { campanha: 'Venda', valor: 50 },
      { campanha: 'Meta Ads partilhado (alocado por proporção de leads)', valor: 40 },
    ]);
  });

  it('does not count commercial cost as Meta ad spend', () => {
    const result = allocateOfferAdSpend(
      [entry('Comercial', 200), entry('[Lead Gen] [TVDE Drivers]', 100)],
      ['Venda'],
      1,
    );

    expect(result.adsTotal).toBe(100);
  });
});
