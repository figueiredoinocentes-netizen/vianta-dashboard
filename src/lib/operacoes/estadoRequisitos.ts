// Regras de negócio da ficha da viatura: uma viatura só pode passar a
// "Para Venda" ou "Para Aluguer" com os campos mínimos preenchidos
// (características, categorias TVDE, garantia e as três simulações de crédito).
// A bateria e a autonomia só são exigidas quando a viatura é elétrica.
//
// ⚠️ Esta lista está replicada em `netlify/functions/central.js` (guardas do
// servidor). Ao alterar aqui, alterar lá também.
import { normalizeText } from './constants';

/** Estados que só podem ser atribuídos com a ficha completa. */
export const ESTADOS_FICHA_OBRIGATORIA = ['Para Venda', 'Para Aluguer'] as const;

/** Veículos elegíveis na Uber (Lisboa) — para confirmar as categorias TVDE. */
export const URL_VEICULOS_ELEGIVEIS_UBER =
  'https://www.uber.com/pt/pt-pt/eligible-vehicles/?city=lisbon';

/** Campos da ficha que contam para a validação (um `Carro` ou os valores do formulário). */
export type ValoresFicha = {
  combustivel?: unknown;
  cavalos?: unknown;
  caixa?: unknown;
  bateria_kwh?: unknown;
  autonomia_km?: unknown;
  categorias_tvde?: unknown;
  garantia_viatura?: unknown;
  credito_120_meses?: unknown;
  credito_60_meses?: unknown;
  credito_48_meses?: unknown;
};

export interface CampoObrigatorio {
  /** Coluna correspondente na tabela `carros`. */
  campo: keyof ValoresFicha;
  /** Etiqueta mostrada ao utilizador. */
  label: string;
  /** Só é exigido quando a viatura é elétrica. */
  apenasEletricos?: boolean;
}

/** Campos mínimos da ficha, pela ordem em que são mostrados ao utilizador. */
export const CAMPOS_OBRIGATORIOS: CampoObrigatorio[] = [
  { campo: 'cavalos', label: 'Cavalos (cv)' },
  { campo: 'caixa', label: 'Caixa' },
  { campo: 'bateria_kwh', label: 'Bateria (kWh)', apenasEletricos: true },
  { campo: 'autonomia_km', label: 'Autonomia (km)', apenasEletricos: true },
  { campo: 'categorias_tvde', label: 'Categorias TVDE' },
  { campo: 'garantia_viatura', label: 'Garantia viatura' },
  { campo: 'credito_120_meses', label: 'Simulação de crédito — 120 meses' },
  { campo: 'credito_60_meses', label: 'Simulação de crédito — 60 meses' },
  { campo: 'credito_48_meses', label: 'Simulação de crédito — 48 meses' },
];

const preenchido = (v: unknown) => v != null && String(v).trim() !== '';

export const eEletrico = (v: ValoresFicha): boolean =>
  normalizeText(String(v.combustivel ?? '')).includes('eletric');

export const exigeFicha = (estado: string | null | undefined): boolean =>
  !!estado && (ESTADOS_FICHA_OBRIGATORIA as readonly string[]).includes(estado);

/** Campos da ficha exigidos para esta viatura (bateria/autonomia só nos elétricos). */
export function camposObrigatorios(v: ValoresFicha): CampoObrigatorio[] {
  const eletrico = eEletrico(v);
  return CAMPOS_OBRIGATORIOS.filter((c) => !c.apenasEletricos || eletrico);
}

/** Campos da ficha ainda por preencher. */
export function camposEmFalta(v: ValoresFicha): CampoObrigatorio[] {
  return camposObrigatorios(v).filter((c) => !preenchido(v[c.campo]));
}

/** O que falta para a viatura poder assumir `estado` (lista vazia = pode passar). */
export function faltamParaEstado(
  v: ValoresFicha,
  estado: string | null | undefined,
): CampoObrigatorio[] {
  return exigeFicha(estado) ? camposEmFalta(v) : [];
}

/** Mensagem única para os avisos (toasts). */
export function mensagemCamposEmFalta(faltam: CampoObrigatorio[], estado: string): string {
  return `Para passar a «${estado}» falta preencher: ${faltam.map((f) => f.label).join(', ')}.`;
}
