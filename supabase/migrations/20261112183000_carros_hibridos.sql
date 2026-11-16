-- Dois tipos de combustível reais e indicador plug-in para viaturas híbridas.
-- Valores nullable preservam viaturas existentes e não-híbridas.
alter table public.carros
  add column if not exists combustivel_principal text,
  add column if not exists combustivel_secundario text,
  add column if not exists plug_in boolean;

comment on column public.carros.combustivel_principal is 'Primeiro combustível real de uma viatura híbrida (ex.: Gasolina).';
comment on column public.carros.combustivel_secundario is 'Segundo combustível real de uma viatura híbrida (ex.: Elétrico).';
comment on column public.carros.plug_in is 'Indica se a viatura híbrida pode ser carregada à tomada.';
