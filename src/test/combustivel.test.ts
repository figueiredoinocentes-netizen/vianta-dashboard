import { describe, expect, it } from 'vitest';
import { descricaoCombustivel } from '@/lib/operacoes/combustivel';

describe('descricaoCombustivel', () => {
  it('não mexe em combustíveis simples', () => {
    expect(descricaoCombustivel({ combustivel: 'Elétrico' })).toBe('Elétrico');
  });
  it('híbrido plug-in', () => {
    expect(descricaoCombustivel({ combustivel: 'Híbrido', combustivel_principal: 'Gasolina', combustivel_secundario: 'Elétrico', plug_in: true }))
      .toBe('Híbrido Plug-in (Gasolina + Elétrico)');
  });
  it('híbrido não plug-in', () => {
    expect(descricaoCombustivel({ combustivel: 'Híbrido', combustivel_principal: 'Gasolina', combustivel_secundario: 'Elétrico', plug_in: false }))
      .toBe('Híbrido (Gasolina + Elétrico)');
  });
  it('híbrido sem detalhe', () => {
    expect(descricaoCombustivel({ combustivel: 'Híbrido' })).toBe('Híbrido');
  });
});
