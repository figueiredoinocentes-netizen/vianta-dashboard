import { describe, expect, it } from 'vitest';
import { salesToDrivers } from '@/lib/dashboard/salesToDrivers';
import type { SupabaseSale } from '@/lib/dashboard/salesToDrivers';

const sale = (overrides: Partial<SupabaseSale> = {}): SupabaseSale => ({
  id: 1,
  tipo: 'compra',
  carro_id: null,
  motorista_id: null,
  ghl_contact_id: 'contact-1',
  cliente_nome: 'Cliente',
  data_lead: '2026-09-01',
  data_entrada: '2026-09-04',
  data_saida: null,
  valor_total: 15750,
  valor_semanal: null,
  fonte: 'Meta Ads',
  ...overrides,
});

describe('salesToDrivers', () => {
  it('maps a purchase value and delivery date to the dashboard revenue fields', () => {
    const [driver] = salesToDrivers([sale()]);
    expect(driver).toMatchObject({
      id: 'contact-1',
      tipoOferta: 'compra',
      ticket: 15750,
      dataFecho: '2026-09-04',
      fonte: 'Meta Ads',
    });
  });

  it('maps weekly rental value without converting it to monthly prematurely', () => {
    const [driver] = salesToDrivers([sale({ tipo: 'aluguer', valor_total: null, valor_semanal: '290' })]);
    expect(driver).toMatchObject({ tipoOferta: 'aluguer', ticket: 290 });
  });

  it('keeps missing sale values blank instead of substituting the stock price', () => {
    const [driver] = salesToDrivers([sale({ valor_total: null })]);
    expect(driver.ticket).toBeNull();
  });

  it('uses motorista identity as fallback and excludes rows without an identity', () => {
    const mapped = salesToDrivers([
      sale({ ghl_contact_id: null, motorista_id: 42 }),
      sale({ id: 2, ghl_contact_id: null, motorista_id: null }),
    ]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].id).toBe('motorista-42');
  });

  it('ignores types outside purchase, rental, and slot', () => {
    expect(salesToDrivers([sale({ tipo: 'investidor' })])).toEqual([]);
  });
});
