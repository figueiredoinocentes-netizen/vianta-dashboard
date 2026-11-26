// Descrição do combustível para mostrar ao cliente/comercial.
// Num híbrido junta os dois combustíveis e, quando um é elétrico, se é plug-in:
// "Híbrido Plug-in (Gasolina + Elétrico)", "Híbrido (Gasolina + Elétrico)".
//
// ⚠️ Replicado em propostas-vianta (netlify/functions/carros.js). Ao alterar aqui, alterar lá.
import { normalizeText } from './constants';

type ComCombustivel = {
  combustivel?: string | null;
  combustivel_principal?: string | null;
  combustivel_secundario?: string | null;
  plug_in?: boolean | null;
};

const limpo = (v: unknown) => (v == null ? '' : String(v).trim());

export function descricaoCombustivel(v: ComCombustivel): string {
  const base = limpo(v.combustivel);
  if (!normalizeText(base).includes('hibrid')) return base;
  const partes = [limpo(v.combustivel_principal), limpo(v.combustivel_secundario)].filter(Boolean);
  const temEletrico = partes.some((p) => normalizeText(p).includes('eletric'));
  const nome = temEletrico && v.plug_in === true ? 'Híbrido Plug-in' : 'Híbrido';
  return partes.length ? `${nome} (${partes.join(' + ')})` : nome;
}
