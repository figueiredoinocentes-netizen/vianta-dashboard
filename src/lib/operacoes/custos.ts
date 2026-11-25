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

/**
 * Preço de compra (s/ IVA) tirado das faturas de compra (tipo 'Compra') da viatura.
 * `null` quando não há fatura (consignação, viaturas antigas): aí vale o `preco_compra` da ficha.
 */
export function precoCompraFatura(movs: Movimento[]): number | null {
  const faturas = movs.filter((m) => m.tipo === 'Compra');
  if (!faturas.length) return null;
  return faturas.reduce((a, m) => a + Math.abs(semIva(m)), 0);
}

/** Preço de compra da viatura: a fatura de compra quando existe, senão o `preco_compra` da ficha. */
export const precoCompra = (carro: Carro, movs: Movimento[]) =>
  precoCompraFatura(movs) ?? toNum(carro.preco_compra);

/** Taxa de IVA da venda (0 ou 23) ou `null` se ainda não foi escolhida na ficha. */
export function ivaVenda(carro: Carro): number | null {
  if (carro.iva_venda == null || carro.iva_venda === '') return null;
  const n = Number(carro.iva_venda);
  return n === 0 || n === 23 ? n : null;
}

/** Preço de venda da ficha s/ IVA, ou `null` se a taxa de IVA ainda não foi escolhida. */
export function precoVendaSemIva(carro: Carro): number | null {
  const iva = ivaVenda(carro);
  if (iva == null) return null;
  return Math.round((toNum(carro.preco_venda) / (1 + iva / 100)) * 100) / 100;
}

export function resumoCarro(carro: Carro, movs: Movimento[]) {
  // A fatura de compra (tipo 'Compra') é o preço de compra: não conta como custo.
  const custos = -movs
    .filter((m) => toNum(m.valor) < 0 && m.tipo !== 'Compra')
    .reduce((a, m) => a + semIva(m), 0);
  const receitas = movs.filter((m) => toNum(m.valor) > 0).reduce((a, m) => a + semIva(m), 0);
  const compra = precoCompra(carro, movs);
  // Com a taxa de IVA escolhida na ficha usa o preço s/ IVA; sem ela, o preço da ficha tal como está.
  const venda = carro.tipo_gestao === 'Venda' ? precoVendaSemIva(carro) ?? toNum(carro.preco_venda) : 0;
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
