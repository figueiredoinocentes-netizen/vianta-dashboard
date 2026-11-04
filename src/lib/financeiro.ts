// Área Financeiro: faturas de custos (tabela `financeiro`, a mesma dos custos por viatura).
// Convenção da tabela: custos negativos; `valor` = total c/ IVA, `valor_sem_iva` e `iva` em separado.
import { TIPOS_CUSTO, toNum } from '@/lib/operacoes/custos';
import type { Movimento } from '@/lib/operacoes/types';

export const CENTROS_CUSTO = ['TVDE', 'Stand', 'Turismo', 'Geral'] as const;

/** Sugestões para a Natureza do Custo (coluna `categoria`): a lista base + as que já existem na tabela. */
export function naturezasSugeridas(movs: Movimento[]): string[] {
  const set = new Set<string>(TIPOS_CUSTO);
  for (const m of movs) if (m.categoria) set.add(m.categoria);
  return [...set];
}

/** Só custos (valor negativo, ou tipo Custo/Despesa ainda sem valor). */
export const eCusto = (m: Movimento) =>
  toNum(m.valor) < 0 || (toNum(m.valor) === 0 && (m.tipo === 'Custo' || m.tipo === 'Despesa'));

/** Valor s/ IVA de um custo, positivo. `soTotal` = só foi registado o total c/ IVA. */
export function valorSemIva(m: Movimento): { valor: number; soTotal: boolean } {
  if (m.valor_sem_iva != null && m.valor_sem_iva !== '') return { valor: Math.abs(toNum(m.valor_sem_iva)), soTotal: false };
  return { valor: Math.abs(toNum(m.valor)), soTotal: true };
}

/** PDF ou imagem, pelo nome/caminho do ficheiro. */
export const ePdf = (nome?: string | null) => !/\.(jpe?g|png|webp|heic)$/i.test(nome || '');

export const mesDe = (data: string | null) => (data ? data.slice(0, 7) : '');

export function nomeMes(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}
