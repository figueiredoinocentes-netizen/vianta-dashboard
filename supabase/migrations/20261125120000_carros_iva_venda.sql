-- Taxa de IVA da venda da viatura (0% ou 23%), escolhida na ficha comercial.
-- Serve para obter o preço de venda s/ IVA a partir do preço da ficha (c/ IVA):
--   s/ IVA = preco_venda / (1 + iva_venda / 100)
-- NULL = por definir (viaturas antigas).
-- Correr no SQL Editor do projeto Central Vianta (tuwcllpwvxzmrgrqviqu). Idempotente.
alter table public.carros
  add column if not exists iva_venda numeric;

alter table public.carros drop constraint if exists carros_iva_venda_check;
alter table public.carros
  add constraint carros_iva_venda_check
  check (iva_venda is null or iva_venda in (0, 23));

comment on column public.carros.iva_venda is
  'Taxa de IVA da venda (0 ou 23). preco_venda é c/ IVA; s/ IVA = preco_venda / (1 + iva_venda/100). NULL = por definir.';

notify pgrst, 'reload schema';
