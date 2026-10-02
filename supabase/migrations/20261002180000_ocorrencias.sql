-- Ocorrências por viatura (danos, avarias, avisos) com fotos, ligadas a `carros` e aos custos em `financeiro`.
create table if not exists public.ocorrencias (
  id serial primary key,
  carro_id integer not null references public.carros(id) on delete cascade,
  data date not null default current_date,
  tipo text not null default 'Dano' check (tipo in ('Dano', 'Avaria', 'Aviso', 'Outro')),
  descricao text,
  gravidade text not null default 'Média' check (gravidade in ('Baixa', 'Média', 'Alta')),
  estado text not null default 'Por resolver' check (estado in ('Por resolver', 'Em reparação', 'Resolvido')),
  fotos jsonb not null default '[]'::jsonb,
  reportado_por text,
  resolvido_em date,
  created_at timestamptz not null default now()
);

create index if not exists ocorrencias_carro_id_idx on public.ocorrencias (carro_id);

-- Só acessível pela API da Central (service key); sem políticas, a chave pública não vê nada.
alter table public.ocorrencias enable row level security;

-- Custo de uma reparação aponta para a ocorrência que o originou (opcional).
alter table public.financeiro
  add column if not exists ocorrencia_id integer references public.ocorrencias(id) on delete set null;

notify pgrst, 'reload schema';
