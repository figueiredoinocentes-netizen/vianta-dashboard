import type { Carro } from './types';

export const STATUSES = [
  'Alugado',
  'Para Venda',
  'Para Aluguer',
  'Em Preparação',
  'Inativo',
  'Manutenção',
  'Vendido',
] as const;

export const COMBUSTIVEIS = ['Elétrico', 'Gasóleo/Diesel', 'Gasolina', 'GPL', 'Híbrido'] as const;

export const CATEGORIAS_ARMAZEM = [
  'Lubrificantes',
  'Filtros',
  'Travões',
  'Pneus',
  'Fluidos',
  'Documentação',
  'Segurança',
  'Limpeza',
  'Outro',
] as const;

// Cores dos badges de estado (equivalentes aos .badge-* do operacoes.html).
export const BADGE_CLASS: Record<string, string> = {
  Alugado: 'bg-[#064e3b] text-[#6ee7b7]',
  'Para Venda': 'bg-[#1e3a5f] text-[#93c5fd]',
  Inativo: 'bg-[#3d2e00] text-[#fde68a]',
  Manutenção: 'bg-[#78350f] text-[#fbbf24]',
  Vendido: 'bg-[#1f2937] text-[#9ca3af]',
  'Em Preparação': 'bg-[#312e81] text-[#a5b4fc]',
  'Para Aluguer': 'bg-[#14532d] text-[#86efac]',
};

// Checklist de preparação — Instrução de Trabalho "Preparação de Viatura STAND".
// Aluguer ainda não tem checklist própria definida (fica vazia por agora).
// Segue a divisão da própria Instrução de Trabalho: Documentação vs Estado da
// viatura (aqui "A Fazer").
export const CHECKLIST_GROUPS_VENDA: Record<string, string[]> = {
  Documentos: [
    'DUA ou DAV',
    'Declaração de Circulação',
    'Validar Seguro com o cliente',
    'Inspeção',
    'Livros de Manutenção e Manual de Utilizador',
    'Garantia',
    '2ª chave (quando aplicável)',
  ],
  'A Fazer': [
    'Pneu suplente ou kit furos',
    'Triângulo e colete',
    'Cabo de carregador (aplicável a BEV)',
    'Pintura',
    'Pneus',
    'Mecânica (óleo, refrigerante, limpa para-brisas, bateria 12v)',
    'Carga elétrica (aplicável a BEV)',
    'Limpeza exterior e interior',
    'Tapetes',
  ],
};

// Da Instrução de Trabalho "Preparação de Viatura TVDE" — os itens físicos que
// o documento lista sob "Documentação" (2ª chave, extintor, placas...) ficam em
// "A Fazer" aqui, como no de Venda, para bater certo com a integração da Drive
// (só documentos de papel fazem sentido lá).
export const CHECKLIST_GROUPS_ALUGUER: Record<string, string[]> = {
  Documentos: [
    'DUA ou DAV',
    'Declaração de Circulação',
    'Validar Seguro',
    'Inspeção TVDE',
    'Livros de Manutenção e Manual de Utilizador',
    'Inscrição nas plataformas',
    '2ª chave (juntar no arquivo da viatura)',
  ],
  'A Fazer': [
    'Pneu suplente ou kit furos',
    'Triângulo e colete',
    'Extintor',
    'Cabo de carregador (aplicável a BEV)',
    'Placas TVDE',
    'Placa não fumador',
    'Placa RNAT (quando aplicável)',
    'Pintura',
    'Pneus',
    'Mecânica (óleo, refrigerante, limpa para-brisas, bateria 12v)',
    'Carga elétrica (aplicável a BEV)',
    'Limpeza exterior e interior',
  ],
};

// Palavras-chave para associar ficheiros da Drive aos itens de documentação.
export const DOC_KEYWORDS: Record<string, string[]> = {
  'DUA ou DAV': ['dua', 'dav'],
  'Declaração de Circulação': ['circulacao', 'declaracao'],
  'Validar Seguro com o cliente': ['seguro'],
  Inspeção: ['inspecao', 'ipo'],
  'Livros de Manutenção e Manual de Utilizador': ['manual', 'livro'],
  Garantia: ['garantia'],
  'Validar Seguro': ['seguro'],
  'Inspeção TVDE': ['inspecao', 'ipo', 'tvde'],
  'Inscrição nas plataformas': ['inscricao', 'plataforma', 'uber', 'bolt'],
};

export function getChecklistGroups(v: Carro): Record<string, string[]> {
  if (v.tipo_gestao === 'Venda') return CHECKLIST_GROUPS_VENDA;
  if (v.tipo_gestao === 'Aluguer') return CHECKLIST_GROUPS_ALUGUER;
  return {};
}

export function getChecklist(v: Carro): string[] {
  return Object.values(getChecklistGroups(v)).flat();
}

/** Documentos da checklist ainda por validar (os itens "A Fazer" são trabalhos, em `ocorrencias`). */
export function getMissingItems(v: Carro): string[] {
  const done = v.checklist_prep || {};
  return (getChecklistGroups(v).Documentos || []).filter((item) => !done[item]);
}

export function destinoDepoisDePreparacao(v: Carro): string {
  return v.tipo_gestao === 'Aluguer' ? 'Para Aluguer' : 'Para Venda';
}

export function normalizeText(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Barra de pesquisa global (matrícula, modelo, motorista, investidor, armazém…).
export function matchesSearch(q: string, item: object): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const rec = item as Record<string, unknown>;
  const fields = [
    rec.matricula,
    rec.marca_modelo,
    rec.proprietario,
    rec.motorista_atual,
    rec.item,
    rec.nome,
    rec.categoria,
    rec.email,
    rec.telefone,
  ];
  return fields.some((f) => f && String(f).toLowerCase().includes(needle));
}

export function parseEuros(value: string | number | null | undefined): number {
  const p = parseFloat(String(value || '0').replace(/[^\d.,]/g, ''));
  return isNaN(p) ? 0 : p;
}

export function getStats(carros: Carro[]) {
  const c = (fn: (v: Carro) => boolean) => carros.filter(fn).length;
  return {
    total: carros.length,
    frota: c((v) => v.estado === 'Alugado' && v.tipo_gestao !== 'Slot'),
    stock: c(
      (v) => (v.estado === 'Para Venda' || v.estado === 'Para Aluguer') && v.tipo_gestao !== 'Slot',
    ),
    inativos: c((v) => v.estado === 'Inativo'),
    manutencao: c((v) => v.estado === 'Manutenção'),
    vendidos: c((v) => v.estado === 'Vendido'),
    preparacao: c((v) => v.estado === 'Em Preparação'),
  };
}
