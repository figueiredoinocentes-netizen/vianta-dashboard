-- Livro de movimentos por viatura: reutiliza a tabela `financeiro` (vazia, já com carro_id).
-- Convenção: `valor` = total com IVA; custos negativos, receitas positivas.
alter table public.financeiro
  add column if not exists descricao text,
  add column if not exists valor_sem_iva numeric,
  add column if not exists iva numeric,
  add column if not exists kms text;

-- Preço a que a viatura foi comprada (s/ IVA), para a margem de venda.
alter table public.carros
  add column if not exists preco_compra text;

create index if not exists financeiro_carro_id_idx on public.financeiro (carro_id);
