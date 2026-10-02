// Trabalhos de uma viatura = preparação (checklist "A Fazer") + ocorrências (danos, avarias…).
// Ambos vivem na tabela `ocorrencias`; `origem` distingue-os.
import type { Carro, Ocorrencia } from './types';
import { getChecklistGroups } from './constants';

export const TIPOS_TRABALHO = [
  'Dano',
  'Avaria',
  'Revisão',
  'Pintura',
  'Pneus',
  'Mecânica',
  'Limpeza',
  'Equipamento',
  'Aviso',
  'Seguro',
  'IUC / IMT',
  'Multa',
  'Comissão',
  'Inspeção',
  'Outro',
] as const;
/** Tipos em que faz sentido indicar a gravidade. */
export const TIPOS_COM_GRAVIDADE: readonly string[] = ['Dano', 'Avaria', 'Aviso'];
export const GRAVIDADES = ['Baixa', 'Média', 'Alta'] as const;
export const ESTADOS_TRABALHO = ['Por fazer', 'Em curso', 'Feito', 'Dispensado'] as const;

export const ORIGEM_PREP = 'Preparacao';
export const ORIGEM_OCORR = 'Ocorrencia';

/** Trabalho concluído (feito ou dispensado) — já não bloqueia a viatura. */
export const concluido = (o: Ocorrencia) => o.estado === 'Feito' || o.estado === 'Dispensado';
export const emAberto = (o: Ocorrencia) => !concluido(o);
export const ePreparacao = (o: Ocorrencia) => o.origem === ORIGEM_PREP;

export const gravidadeClass = (g: string | null) =>
  g === 'Alta'
    ? 'bg-red-500/15 text-red-300'
    : g === 'Média'
      ? 'bg-amber-500/15 text-amber-300'
      : 'bg-muted text-muted-foreground';

/** Itens "A Fazer" da checklist que dão origem a trabalhos de preparação. */
export function itensPreparacao(v: Carro): string[] {
  return getChecklistGroups(v)['A Fazer'] || [];
}

/** Tipo de trabalho correspondente a um item da checklist. */
export function tipoDoItem(item: string): string {
  if (/^pintura/i.test(item)) return 'Pintura';
  if (/^pneus/i.test(item)) return 'Pneus';
  if (/^mec[aâ]nica/i.test(item)) return 'Mecânica';
  if (/^limpeza/i.test(item)) return 'Limpeza';
  if (/^carga/i.test(item)) return 'Outro';
  return 'Equipamento';
}

/** Categoria de custo (tabela `financeiro`) sugerida para um trabalho. */
export function categoriaDoTrabalho(tipo: string | null, origem: string | null): string {
  if (tipo === 'Pneus' || tipo === 'Seguro' || tipo === 'IUC / IMT' || tipo === 'Multa' || tipo === 'Comissão') return tipo;
  if (origem === ORIGEM_PREP && tipo !== 'Mecânica') return 'Preparação';
  return 'Manutenção';
}
