-- Percentagem da margem bruta s/ IVA que fica para o investidor (0-100); a Vianta fica com o resto.
-- Por viatura. NULL = por definir. Corrida no SQL Editor do Central Vianta a 2026-11-25.
alter table public.carros
  add column if not exists pct_investidor numeric;

alter table public.carros drop constraint if exists carros_pct_investidor_check;
alter table public.carros
  add constraint carros_pct_investidor_check
  check (pct_investidor is null or (pct_investidor >= 0 and pct_investidor <= 100));

comment on column public.carros.pct_investidor is
  'Percentagem da margem bruta s/ IVA que fica para o investidor (0-100). A Vianta fica com o resto. NULL = por definir.';

notify pgrst, 'reload schema';
