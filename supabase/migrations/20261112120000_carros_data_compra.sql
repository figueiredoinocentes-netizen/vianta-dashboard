-- Data de aquisição da viatura. Não inferir a partir de created_at: este campo
-- representa a criação do registo e não necessariamente a compra.
alter table public.carros
  add column if not exists data_compra date;

comment on column public.carros.data_compra is
  'Data real de aquisição da viatura; null quando não existe fonte confirmada.';

notify pgrst, 'reload schema';
