-- Simulações de crédito, dados técnicos e garantias separadas (viatura / bateria).
-- Texto de propósito (consistente com o resto da tabela). Créditos = prestação mensal em €.
-- A coluna `garantia` genérica é copiada para `garantia_viatura` e depois eliminada.

alter table public.carros
  add column if not exists credito_120_meses text,
  add column if not exists credito_60_meses text,
  add column if not exists credito_48_meses text,
  add column if not exists garantia_viatura text,
  add column if not exists garantia_bateria text,
  add column if not exists cavalos text,
  add column if not exists bateria_kwh text,
  add column if not exists volume_bagageira text,
  add column if not exists estado_bateria_pct text;

update public.carros
   set garantia_viatura = garantia
 where garantia is not null and garantia <> '' and garantia_viatura is null;

alter table public.carros drop column if exists garantia;
