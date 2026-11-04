-- Área Financeiro: registo e categorização das faturas de custos na tabela `financeiro`
-- (a mesma dos custos por viatura; `carro_id` passa a ser opcional na prática — custos gerais ficam sem viatura).
--   n_documento  = nº da fatura / documento do fornecedor
--   centro_custo = TVDE | Stand | Turismo | Geral
--   Natureza do custo = coluna `categoria` já existente (Manutenção, Seguro, …).
alter table public.financeiro
  add column if not exists n_documento text,
  add column if not exists centro_custo text;

alter table public.financeiro alter column carro_id drop not null;

alter table public.financeiro drop constraint if exists financeiro_centro_custo_check;
alter table public.financeiro
  add constraint financeiro_centro_custo_check
  check (centro_custo is null or centro_custo in ('TVDE', 'Stand', 'Turismo', 'Geral'));

create index if not exists financeiro_centro_custo_idx on public.financeiro (centro_custo);

notify pgrst, 'reload schema';
