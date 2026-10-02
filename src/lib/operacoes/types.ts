export interface Carro {
  id: number;
  matricula: string | null;
  marca_modelo: string | null;
  ano: string | number | null;
  combustivel: string | null;
  kms_atuais: string | number | null;
  proprietario: string | null;
  investidor_id: number | null;
  tipo_gestao: string | null;
  estado: string | null;
  preco_venda: string | number | null;
  valor_aluguer_semanal: string | number | null;
  motorista_atual: string | null;
  cliente_id: number | null;
  data_previsao_pronto: string | null;
  foto_url: string | null;
  checklist_prep: Record<string, boolean> | null;
  // Ficha comercial (colunas a criar com supabase/migrations/*_carros_ficha_comercial.sql).
  // Até a migração correr no Supabase estes campos vêm indefinidos.
  versao?: string | null;
  cor?: string | null;
  caixa?: string | null;
  autonomia_km?: string | null;
  categorias_tvde?: string | null;
  caucao?: string | null;
  garantia_viatura?: string | null;
  garantia_bateria?: string | null;
  cavalos?: string | null;
  bateria_kwh?: string | null;
  volume_bagageira?: string | null;
  estado_bateria_pct?: string | null;
  credito_120_meses?: string | null;
  credito_60_meses?: string | null;
  credito_48_meses?: string | null;
  fim_elegibilidade_tvde?: string | null;
  docs_link?: string | null;
  fotos_link?: string | null;
  fotos?: string[] | null;
  obs?: string | null;
  preco_compra?: string | number | null;
}

export interface Motorista {
  id: number;
  nome: string | null;
  email: string | null;
  tipo: string | null;
}

export interface Investidor {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  iban: string | null;
  nif: string | null;
}

export interface Cliente {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
}

export interface ArmazemItem {
  id: number;
  item: string | null;
  categoria: string | null;
  stock_atual: number | string | null;
  stock_minimo: number | string | null;
  unidade: string | null;
  fornecedor: string | null;
  ultima_compra: string | null;
}

export interface Pagamento {
  id: number;
  motorista_id: number | null;
  total_bruto: number | string | null;
  aluguer: number | string | null;
  taxa_admin: number | string | null;
  iva: number | string | null;
  liquidio: number | string | null;
  estado: string | null;
  data_pagamento: string | null;
}

/** Movimento financeiro de uma viatura (tabela `financeiro`). Custos negativos, receitas positivas. */
export interface Movimento {
  id: number;
  carro_id: number | null;
  data: string | null;
  tipo: string | null;
  descricao: string | null;
  contraparte: string | null;
  valor: number | string | null;
  valor_sem_iva: number | string | null;
  iva: number | string | null;
  kms: string | null;
  comprovativo: string | null;
  obs: string | null;
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
}

export interface DriveFolder {
  id: string;
  name?: string;
}

export interface DriveListing {
  files: DriveFile[];
  folder: DriveFolder | null;
}
