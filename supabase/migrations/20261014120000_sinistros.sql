-- Sinistros por viatura: da chegada da ocorrência ao gestor de frota até à resolução.
-- As manutenções (tabela `ocorrencias`) podem apontar para o sinistro que as originou.
create table if not exists public.sinistros (
  id serial primary key,
  carro_id integer not null references public.carros(id) on delete cascade,
  data_inicio date not null default current_date,   -- ocorrência chega ao gestor de frota
  data_fim date,                                   -- sinistro resolvido
  orcamento_seguro numeric(10,2),                  -- orçamento dado pelo seguro
  descricao text,
  created_at timestamptz not null default now()
);

create index if not exists sinistros_carro_id_idx on public.sinistros (carro_id);

-- Só acessível pela API da Central (service key).
alter table public.sinistros enable row level security;

alter table public.ocorrencias
  add column if not exists sinistro_id integer references public.sinistros(id) on delete set null;

create index if not exists ocorrencias_sinistro_id_idx on public.ocorrencias (sinistro_id);

notify pgrst, 'reload schema';
