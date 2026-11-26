-- Textos partilhados do dashboard, iguais para todas as viaturas (ex.: pontos da
-- Oferta Venda/Aluguer TVDE mostrados no Stock comercial). Um ponto por linha.
-- Editados no próprio dashboard (ficha do Stock → Editar).
-- Correr no SQL Editor do projeto Central Vianta (tuwcllpwvxzmrgrqviqu). Idempotente.
create table if not exists public.configuracoes (
  id bigserial primary key,
  chave text not null unique,
  valor text,
  updated_at timestamptz not null default now()
);

alter table public.configuracoes enable row level security;

insert into public.configuracoes (chave, valor) values
  ('oferta_venda', E'Viatura pronta a operar (dístico, inspeção, extintor)\nMediação de financiamento e seguro\nGarantia Standard Vianta: motor e caixa, 18 meses (extensível a 36, com custo adicional)\nAcompanhamento pós-venda\nIntegração na frota Vianta com Slot'),
  ('oferta_aluguer', E'Viatura pronta a trabalhar (dístico e seguro)\nManutenção a cargo da Vianta\nPagamentos semanais (segundas-feiras)\nViatura de substituição garantida\nSaída com 15 dias de aviso, sem contrato longo\nSuporte direto com o gestor de frota\nApp com histórico de despesas e ganhos')
on conflict (chave) do nothing;

notify pgrst, 'reload schema';
