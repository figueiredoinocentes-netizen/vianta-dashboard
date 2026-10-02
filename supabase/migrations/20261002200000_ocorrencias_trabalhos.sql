-- Preparação e ocorrências passam a ser a mesma coisa: "trabalhos" por viatura.
-- origem: 'Preparacao' (vem da checklist "A Fazer") ou 'Ocorrencia' (dano, avaria, aviso…).
-- estado: 'Por fazer', 'Em curso', 'Feito', 'Dispensado' (não se aplica a esta viatura).
alter table public.ocorrencias
  add column if not exists origem text not null default 'Ocorrencia',
  add column if not exists item text;

-- tipo passa a ser livre (a lista vive na app); o estado muda de vocabulário.
alter table public.ocorrencias drop constraint if exists ocorrencias_tipo_check;
alter table public.ocorrencias drop constraint if exists ocorrencias_estado_check;

update public.ocorrencias set estado = case estado
  when 'Por resolver' then 'Por fazer'
  when 'Resolvido' then 'Feito'
  else 'Em curso' end;

alter table public.ocorrencias alter column estado set default 'Por fazer';
alter table public.ocorrencias add constraint ocorrencias_estado_check
  check (estado in ('Por fazer', 'Em curso', 'Feito', 'Dispensado'));
alter table public.ocorrencias add constraint ocorrencias_origem_check
  check (origem in ('Preparacao', 'Ocorrencia'));

-- Um item da checklist só existe uma vez por viatura (a criação automática é idempotente).
create unique index if not exists ocorrencias_carro_item_uniq
  on public.ocorrencias (carro_id, item) where origem = 'Preparacao' and item is not null;

notify pgrst, 'reload schema';
