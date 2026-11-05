// Fatura de compra de uma viatura (Nova Viatura e ficha da viatura):
// validação e registo na tabela `financeiro` (tipo 'Compra', ligada ao carro).
import { MAX_FATURA_MB, createCentral, uploadFatura } from '@/lib/operacoes/central';
import { toNum } from '@/lib/operacoes/custos';

export type FaturaCompraValores = {
  num: string;
  data: string;
  fornecedor: string;
  semIva: string;
  iva: string;
  /** '' = automático pelo tipo de gestão */
  centro: string;
};

export const FATURA_COMPRA_VAZIA: FaturaCompraValores = {
  num: '',
  data: '',
  fornecedor: '',
  semIva: '',
  iva: '',
  centro: '',
};

export const hoje = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Centro de custo por defeito: Venda → Stand, resto → TVDE. */
export const centroPorGestao = (gestao?: string | null) => (gestao === 'Venda' ? 'Stand' : 'TVDE');

/** Valida; devolve a mensagem de erro ou null. */
export function validarFaturaCompra(v: FaturaCompraValores, file: File | null): string | null {
  if (!file) return 'Anexe a fatura de compra da viatura.';
  if (file.size > MAX_FATURA_MB * 1024 * 1024) return `A fatura tem mais de ${MAX_FATURA_MB} MB.`;
  if (!Math.abs(toNum(v.semIva))) return 'Indique o valor s/ IVA da fatura de compra.';
  return null;
}

/** Guarda o PDF e regista a fatura no Financeiro. Devolve o valor s/ IVA (= preço de compra). */
export async function registarFaturaCompra(args: {
  carroId: number | null;
  descricao: string;
  valores: FaturaCompraValores;
  file: File;
  gestao?: string | null;
  /** caminho já guardado (Nova Viatura guarda o ficheiro antes de criar o carro) */
  ficheiro?: string;
}): Promise<number> {
  const { valores: v } = args;
  const semIva = Math.abs(toNum(v.semIva));
  const iva = v.iva.trim() ? Math.abs(toNum(v.iva)) : 0;
  const data = v.data || hoje();
  const ficheiro = args.ficheiro ?? (await uploadFatura(args.file, data));
  await createCentral('financeiro', {
    tipo: 'Compra',
    carro_id: args.carroId,
    n_documento: v.num.trim() || null,
    data,
    descricao: args.descricao,
    contraparte: v.fornecedor.trim() || null,
    centro_custo: v.centro || centroPorGestao(args.gestao),
    categoria: 'Compra de viatura',
    valor_sem_iva: -semIva,
    iva: -iva,
    valor: -round2(semIva + iva),
    ficheiro,
    ficheiro_nome: args.file.name,
  });
  return semIva;
}
