-- Forma de aquisição da viatura, obrigatória ao criar uma viatura nova no dashboard:
--   'Compra'      → a fatura de compra é registada na tabela `financeiro` (tipo 'Compra', ligada ao carro)
--   'Consignação' → sem fatura de compra
-- Viaturas antigas ficam a NULL.
alter table public.carros
  add column if not exists aquisicao text;

alter table public.carros drop constraint if exists carros_aquisicao_check;
alter table public.carros
  add constraint carros_aquisicao_check
  check (aquisicao is null or aquisicao in ('Compra', 'Consignação'));

notify pgrst, 'reload schema';
