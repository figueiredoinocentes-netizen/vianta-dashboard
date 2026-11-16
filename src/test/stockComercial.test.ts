import { describe, expect, it } from 'vitest';
import {
  ESTADOS_EDITAVEIS_VENDA,
  indisponivelParaOferta,
  visivelNoStockComercial,
} from '@/lib/operacoes/stockComercial';
import type { Carro } from '@/lib/operacoes/types';

const carro = (extra: Partial<Carro> = {}) =>
  ({ id: 1, tipo_gestao: 'Venda', estado: 'Acordo Verbal', ...extra }) as Carro;

describe('Stock comercial — estados de venda', () => {
  it('mantém o acordo verbal visível à equipa na tab Vendas, mas não na tab Aluguer', () => {
    const reservado = carro({ tipo_gestao: 'Venda e Aluguer' });
    expect(visivelNoStockComercial(reservado, 'Venda')).toBe(true);
    expect(visivelNoStockComercial(reservado, 'Aluguer')).toBe(false);
  });

  it('permite ao comercial escolher apenas Para Venda, Acordo Verbal e Vendido', () => {
    expect(ESTADOS_EDITAVEIS_VENDA).toEqual(['Para Venda', 'Acordo Verbal', 'Vendido']);
  });

  it('identifica o acordo verbal como indisponível para oferta a outros clientes', () => {
    expect(indisponivelParaOferta('Acordo Verbal')).toBe(true);
    expect(indisponivelParaOferta('Para Venda')).toBe(false);
  });
});
