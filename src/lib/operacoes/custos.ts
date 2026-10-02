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
export const TIPOS_RECEITA = ['Receita aluguer', 'Receita venda'] as const;

/** Aceita "12500", "12.500,50", "300€/semana" … e devolve um número (0 se vazio). */
export function toNum(x: unknown): number {
  if (x == null) return 0;
  let t = String(x).replace(/[^\d.,-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export const eur = (n: number) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} €`;

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
  return { custos, receitas, compra, venda, vendido, margem };
}
