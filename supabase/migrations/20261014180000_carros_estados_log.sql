-- Log de estados das viaturas: cada linha é um período em que o carro esteve num estado.
-- `ate` null = estado atual. Alimentado por trigger, por isso apanha qualquer mudança
-- (app, SQL Editor, outras ferramentas). Base da métrica "dias médios parados".
create table if not exists public.carros_estados_log (
  id serial primary key,
  carro_id integer not null references public.carros(id) on delete cascade,
  estado text,
  desde timestamptz not null default now(),
  ate timestamptz
);

create index if not exists carros_estados_log_carro_idx on public.carros_estados_log (carro_id);
create unique index if not exists carros_estados_log_aberto_uniq
  on public.carros_estados_log (carro_id) where ate is null;

-- Só acessível pela API da Central (service key).
alter table public.carros_estados_log enable row level security;

create or replace function public.log_estado_carro() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.carros_estados_log (carro_id, estado) values (new.id, new.estado);
  elsif new.estado is distinct from old.estado then
    update public.carros_estados_log set ate = now() where carro_id = new.id and ate is null;
    insert into public.carros_estados_log (carro_id, estado) values (new.id, new.estado);
  end if;
  return new;
end;
$$;

drop trigger if exists carros_log_estado on public.carros;
create trigger carros_log_estado
  after insert or update of estado on public.carros
  for each row execute function public.log_estado_carro();

-- Arranque: estado atual de cada carro, a contar de hoje (datas reais podem ser corrigidas à mão).
insert into public.carros_estados_log (carro_id, estado)
select c.id, c.estado from public.carros c
where not exists (select 1 from public.carros_estados_log l where l.carro_id = c.id and l.ate is null);

notify pgrst, 'reload schema';
