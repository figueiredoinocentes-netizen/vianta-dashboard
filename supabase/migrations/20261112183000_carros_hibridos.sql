-- Combustível secundário e indicador plug-in para viaturas híbridas.
-- Valores são nullable para preservar veículos existentes e não-híbridos.
alter table public.carros
  add column if not exists combustivel_secundario text,
  add column if not exists plug_in boolean;

comment on column public.carros.combustivel_secundario is 'Segundo combustível das viaturas híbridas (ex.: Gasolina, Elétrico).';
comment on column public.carros.plug_in is 'Indica se a viatura híbrida é plug-in; NULL para não-híbridos ou por confirmar.';
