// Regras de negócio da ficha comercial. Uma viatura só pode ficar disponível
// quando os campos exigidos pelo seu tipo de gestão estiverem preenchidos.
//
// ⚠️ Esta lista está replicada em `netlify/functions/central.js` (guardas do
// servidor). Ao alterar aqui, alterar lá também.
import { normalizeText } from './constants';

export const TIPO_GESTAO_MISTO = 'Venda e Aluguer';
export const ESTADO_MISTO = 'Para Venda e Aluguer';

/** Estados que só podem ser atribuídos com a ficha completa. */
export const ESTADOS_FICHA_OBRIGATORIA = ['Para Venda', 'Para Aluguer', ESTADO_MISTO] as const;

/** Veículos elegíveis na Uber (Lisboa) — para confirmar as categorias TVDE. */
export const URL_VEICULOS_ELEGIVEIS_UBER =
  'https://www.uber.com/pt/pt-pt/eligible-vehicles/?city=lisbon';

/** Campos da ficha que contam para a validação (um `Carro` ou os valores do formulário). */
export type ValoresFicha = {
  tipo_gestao?: unknown;
  combustivel?: unknown;
  cavalos?: unknown;
  caixa?: unknown;
  bateria_kwh?: unknown;
  autonomia_km?: unknown;
  categorias_tvde?: unknown;
  garantia_viatura?: unknown;
  preco_venda?: unknown;
  credito_120_meses?: unknown;
  credito_60_meses?: unknown;
  credito_48_meses?: unknown;
  valor_aluguer_semanal?: unknown;
  caucao?: unknown;
};

export interface CampoObrigatorio {
  /** Coluna correspondente na tabela `carros`. */
  campo: keyof ValoresFicha;
  /** Etiqueta mostrada ao utilizador. */
  label: string;
  /** Só é exigido quando a viatura é elétrica. */
  apenasEletricos?: boolean;
  /** Oferta em que o campo é necessário; sem valor = comum às duas. */
  oferta?: 'venda' | 'aluguer';
}

/** Campos mínimos da ficha, pela ordem em que são mostrados ao utilizador. */
export const CAMPOS_OBRIGATORIOS: CampoObrigatorio[] = [
  { campo: 'cavalos', label: 'Cavalos (cv)' },
  { campo: 'caixa', label: 'Caixa' },
  { campo: 'bateria_kwh', label: 'Bateria (kWh)', apenasEletricos: true },
  { campo: 'autonomia_km', label: 'Autonomia (km)', apenasEletricos: true },
  { campo: 'categorias_tvde', label: 'Categorias TVDE' },
  { campo: 'garantia_viatura', label: 'Garantia viatura' },
  { campo: 'preco_venda', label: 'Preço de venda', oferta: 'venda' },
  { campo: 'credito_120_meses', label: 'Simulação de crédito — 120 meses', oferta: 'venda' },
  { campo: 'credito_60_meses', label: 'Simulação de crédito — 60 meses', oferta: 'venda' },
  { campo: 'credito_48_meses', label: 'Simulação de crédito — 48 meses', oferta: 'venda' },
  { campo: 'valor_aluguer_semanal', label: 'Valor do aluguer semanal', oferta: 'aluguer' },
  { campo: 'caucao', label: 'Caução', oferta: 'aluguer' },
];

const preenchido = (v: unknown) => v != null && String(v).trim() !== '';

export const eEletrico = (v: ValoresFicha): boolean =>
  normalizeText(String(v.combustivel ?? '')).includes('eletric');

export const exigeFicha = (estado: string | null | undefined): boolean =>
  !!estado && (ESTADOS_FICHA_OBRIGATORIA as readonly string[]).includes(estado);

function ofertasExigidas(v: ValoresFicha, estado?: string | null): Set<'venda' | 'aluguer'> {
  const tipo = String(v.tipo_gestao ?? '');
  if (tipo === TIPO_GESTAO_MISTO || estado === ESTADO_MISTO) return new Set(['venda', 'aluguer']);
  if (tipo === 'Venda') return new Set(['venda']);
  if (tipo === 'Aluguer') return new Set(['aluguer']);
  if (estado === 'Para Venda') return new Set(['venda']);
  if (estado === 'Para Aluguer') return new Set(['aluguer']);
  return new Set();
}

/** Campos exigidos para a viatura/tipo indicado (bateria/autonomia só nos elétricos). */
export function camposObrigatorios(v: ValoresFicha, estado?: string | null): CampoObrigatorio[] {
  const eletrico = eEletrico(v);
  const ofertas = ofertasExigidas(v, estado);
  if (!ofertas.size) return [];
  return CAMPOS_OBRIGATORIOS.filter(
    (c) =>
      (!c.apenasEletricos || eletrico) &&
      (!c.oferta || ofertas.has(c.oferta)),
  );
}

/** Campos da ficha ainda por preencher. Pode ser usada no Stock mesmo antes de mudar o estado. */
export function camposEmFalta(v: ValoresFicha, estado?: string | null): CampoObrigatorio[] {
  return camposObrigatorios(v, estado).filter((c) => !preenchido(v[c.campo]));
}

/** O que falta para a viatura poder assumir `estado` (lista vazia = pode passar). */
export function faltamParaEstado(
  v: ValoresFicha,
  estado: string | null | undefined,
): CampoObrigatorio[] {
  return exigeFicha(estado) ? camposEmFalta(v, estado) : [];
}

/** Mensagem única para os avisos (toasts). */
export function mensagemCamposEmFalta(faltam: CampoObrigatorio[], estado: string): string {
  return `Para passar a «${estado}» falta preencher: ${faltam.map((f) => f.label).join(', ')}.`;
}
