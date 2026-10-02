// Cálculo de custos e margens por viatura (tabela `financeiro`).
import type { Carro, Movimento } from './types';

export const TIPOS_CUSTO = [
  'Manutenção',
  'Preparação',
  'Pneus',
  'Seguro',
  'IUC / IMT',
  'Combustível / Energia',
  'Multa',
  'Comissão',
  'Outro',
] as const;
export const TIPOS_RECEITA = ['Receita aluguer', 'Receita slot', 'Receita venda'] as const;

/** Mapeia a categoria escolhida para o `tipo` aceite pela tabela (financeiro_tipo_check). */
export function tipoDaCategoria(categoria: string): string {
  if (categoria === 'Receita aluguer') return 'Receita_Aluguer';
  if (categoria === 'Receita slot') return 'Receita_Slot';
  if (categoria === 'Receita venda') return 'Venda';
  return 'Custo';
}

/** Aceita "12500", "12.500,50", "300€/semana" … e devolve um número (0 se vazio). */
export function toNum(x: unknown): number {
  if (x == null) return 0;
  let t = String(x).replace(/[^\d.,-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export const eur = (n: number) => {
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  const milhares = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${milhares}${dec === '00' ? '' : ',' + dec} €`;
};

/** Valor de um movimento sem IVA (custo ou receita), com sinal. */
export const semIva = (m: Movimento) => (m.valor_sem_iva != null ? toNum(m.valor_sem_iva) : toNum(m.valor));

export function resumoCarro(carro: Carro, movs: Movimento[]) {
  const custos = -movs.filter((m) => toNum(m.valor) < 0).reduce((a, m) => a + semIva(m), 0);
  const receitas = movs.filter((m) => toNum(m.valor) > 0).reduce((a, m) => a + semIva(m), 0);
  const compra = toNum(carro.preco_compra);
  const venda = carro.tipo_gestao === 'Venda' ? toNum(carro.preco_venda) : 0;
  const vendido = carro.estado === 'Vendido';
  // Venda: preço de venda (registado ou o da ficha) − compra − custos.
  const receitaVenda = venda ? Math.max(venda, receitas) : receitas;
  const margem = carro.tipo_gestao === 'Venda' ? receitaVenda - compra - custos : receitas - custos;
  return {
    custos,
    receitas,
    receita: carro.tipo_gestao === 'Venda' ? receitaVenda : receitas,
    compra,
    venda,
    vendido,
    margem,
  };
}

// ── Ligação Preparação ↔ Custos ──
// Um custo registado a partir de um item da checklist guarda `obs = "prep:<item>"`.
export const PREP_PREFIX = 'prep:';
export const prepObs = (item: string) => `${PREP_PREFIX}${item}`;

/** Categoria sugerida para o custo de um item da checklist de preparação. */
export function categoriaDoItem(item: string): string {
  if (/^pneus/i.test(item)) return 'Pneus';
  if (/^mec[aâ]nica/i.test(item)) return 'Manutenção';
  return 'Preparação';
}

/** Custos de preparação de uma viatura: ligados a itens da checklist ou categoria "Preparação". */
export const movsPreparacao = (movs: Movimento[]) =>
  movs.filter((m) => m.obs?.startsWith(PREP_PREFIX) || m.categoria === 'Preparação');
