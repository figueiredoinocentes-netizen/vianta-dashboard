// Cálculo de custos e margens por viatura (tabela `financeiro`).
import type { Carro, Movimento, Ocorrencia } from './types';
import { ePreparacao } from './trabalhos';

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

// ── Custos de preparação ──
/** Custos de preparação: ligados a trabalhos de origem "Preparação" (ou com categoria "Preparação"). */
export const movsPreparacao = (movs: Movimento[], ocorrencias: Ocorrencia[]) => {
  const ids = new Set(ocorrencias.filter(ePreparacao).map((o) => o.id));
  return movs.filter((m) => (m.ocorrencia_id != null && ids.has(m.ocorrencia_id)) || m.categoria === 'Preparação');
};
