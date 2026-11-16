import type { Carro } from './types';

export type GestaoComercial = 'Venda' | 'Aluguer';

/** No painel Vendas o comercial só altera os estados próprios do ciclo de venda. */
export const ESTADOS_EDITAVEIS_VENDA = ['Para Venda', 'Acordo Verbal', 'Vendido'] as const;

const ESTADOS_VISIVEIS = [
  'Para Venda',
  'Acordo Verbal',
  'Para Aluguer',
  'Para Venda e Aluguer',
  'Em Preparação',
  'Manutenção',
];

/** O acordo fica visível para a equipa de vendas, nunca como opção de aluguer. */
export function visivelNoStockComercial(carro: Carro, gestao: GestaoComercial): boolean {
  const pertence = carro.tipo_gestao === gestao || carro.tipo_gestao === 'Venda e Aluguer';
  if (!pertence || !ESTADOS_VISIVEIS.includes(carro.estado || '')) return false;
  return gestao !== 'Aluguer' || carro.estado !== 'Acordo Verbal';
}

/** Estado reservado: mantém-se no painel interno, mas não pode ser oferecido a clientes. */
export const indisponivelParaOferta = (estado: string | null | undefined) => estado === 'Acordo Verbal';
