import { describe, expect, it } from 'vitest';
import { precoCompra, precoCompraFatura, resumoCarro } from '@/lib/operacoes/custos';
import type { Carro, Movimento } from '@/lib/operacoes/types';

const mov = (m: Partial<Movimento>): Movimento =>
  ({ id: 1, carro_id: 1, data: null, tipo: null, categoria: null, descricao: null, contraparte: null,
     valor: null, valor_sem_iva: null, iva: null, kms: null, comprovativo: null, obs: null, ...m }) as Movimento;

const carro = { id: 1, preco_compra: '15000', preco_venda: '20000', tipo_gestao: 'Venda', estado: 'Vendido' } as Carro;

describe('preço de compra a partir da fatura', () => {
  it('sem fatura usa o preco_compra da ficha', () => {
    expect(precoCompraFatura([])).toBeNull();
    expect(precoCompra(carro, [])).toBe(15000);
  });

  it('com fatura usa o valor s/ IVA da fatura, mesmo que a ficha diga outra coisa', () => {
    const movs = [mov({ tipo: 'Compra', valor: -17220, valor_sem_iva: -14000 })];
    expect(precoCompra(carro, movs)).toBe(14000);
  });

  it('fatura sem valor s/ IVA usa o total', () => {
    expect(precoCompraFatura([mov({ tipo: 'Compra', valor: -12000 })])).toBe(12000);
  });

  it('a margem usa a fatura e não conta a fatura como custo', () => {
    const movs = [
      mov({ tipo: 'Compra', valor: -17220, valor_sem_iva: -14000 }),
      mov({ id: 2, tipo: 'Despesa', valor: -615, valor_sem_iva: -500 }),
    ];
    const r = resumoCarro(carro, movs);
    expect(r.compra).toBe(14000);
    expect(r.custos).toBe(500);
    expect(r.margem).toBe(20000 - 14000 - 500);
  });
});

describe('preço de venda s/ IVA a partir da taxa escolhida na ficha', () => {
  it('23% divide por 1,23; 0% fica igual; sem taxa devolve null', async () => {
    const { precoVendaSemIva } = await import('@/lib/operacoes/custos');
    expect(precoVendaSemIva({ ...carro, preco_venda: '24600', iva_venda: 23 } as Carro)).toBe(20000);
    expect(precoVendaSemIva({ ...carro, preco_venda: '20000', iva_venda: 0 } as Carro)).toBe(20000);
    expect(precoVendaSemIva({ ...carro, iva_venda: null } as Carro)).toBeNull();
  });

  it('a margem usa o preço s/ IVA quando a taxa está escolhida', () => {
    const r = resumoCarro({ ...carro, preco_venda: '24600', iva_venda: 23 } as Carro, []);
    expect(r.venda).toBe(20000);
    expect(r.margem).toBe(20000 - 15000);
  });
});

describe('divisão da margem com o investidor', () => {
  it('30% para o investidor, o resto para a Vianta', async () => {
    const { divisaoMargem } = await import('@/lib/operacoes/custos');
    expect(divisaoMargem(2848.46, 30)).toEqual({ investidor: 854.54, vianta: 1993.92 });
    expect(divisaoMargem(1000, 0)).toEqual({ investidor: 0, vianta: 1000 });
  });
});
