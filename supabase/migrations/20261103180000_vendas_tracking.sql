-- Tracking de vendas ligado ao stock — F1
-- Criado 2026-11-03. Correr no SQL Editor do projeto Central Vianta (tuwcllpwvxzmrgrqviqu).
-- Idempotente: pode correr duas vezes sem erro.
--
-- Spec: vianta-brain/vianta-dashboard/DESIGN-vendas-tracking.md

-- ─────────────────────────────────────────────────────────────
-- 1. Tabela vendas — a venda/contrato é a unidade de registo
-- ─────────────────────────────────────────────────────────────
create table if not exists vendas (
  id                 serial primary key,
  tipo               text not null check (tipo in ('compra','aluguer','slot')),
  carro_id           integer references carros(id),
  motorista_id       integer references motoristas(id),
  ghl_contact_id     text not null,
  cliente_nome       text not null,
  data_lead          date,
  data_entrada       date not null,
  data_saida         date,
  valor_total        numeric(10,2),
  valor_semanal      numeric(10,2),
  fonte              text,
  registado_por      text,
  ghl_opportunity_id text unique,
  created_at         timestamptz default now()
);

comment on table vendas is
  'Venda/contrato. Unica fonte de faturacao, ticket e LTV. Aluguer/slot guardam valor semanal; mensal = semanal*4 (nunca guardado).';
comment on column vendas.ghl_contact_id is
  'Identidade do cliente — contacto do CRM. Varias vendas com o mesmo contacto = o mesmo cliente (LTV agrega, primeira conversao conta uma vez).';
comment on column vendas.carro_id is
  'Null no slot (o carro e do motorista) e no backfill historico onde o carro nao e conhecido.';
comment on column vendas.valor_total is 'Compra: preco acordado. Null = por apurar (backfill).';
comment on column vendas.valor_semanal is 'Aluguer/slot: EUR/semana do contrato. Null = por apurar (backfill).';

-- Um carro nao pode ter dois contratos de aluguer abertos
create unique index if not exists vendas_aluguer_aberto_por_carro
  on vendas (carro_id) where data_saida is null and tipo = 'aluguer';

-- Um motorista nao pode ter dois slots abertos
create unique index if not exists vendas_slot_aberto_por_motorista
  on vendas (motorista_id) where data_saida is null and tipo = 'slot';

create index if not exists vendas_data_entrada_idx on vendas (data_entrada);
create index if not exists vendas_ghl_contact_idx  on vendas (ghl_contact_id);

-- NOTA: nao existe CHECK a obrigar valor preenchido.
-- O bloqueio "nao muda para Vendido sem valor" e regra de UI (F2), nao de schema:
-- um CHECK impediria o backfill historico e obrigaria a inventar valores.

-- ─────────────────────────────────────────────────────────────
-- 2. carros — data de venda (espelho de vendas.data_entrada)
-- ─────────────────────────────────────────────────────────────
alter table carros add column if not exists data_venda date;

comment on column carros.data_venda is
  'Espelho de vendas.data_entrada para listagens de stock. Fonte de verdade: vendas.';

-- NAO se altera preco_venda text->numeric nesta fase:
-- o frontend de Stock le esse campo como texto. Faz-se em F3 com o codigo a acompanhar.

-- ─────────────────────────────────────────────────────────────
-- 3. meta_spend_daily — custo diário por campanha
-- ─────────────────────────────────────────────────────────────
-- Porque não se usa meta_insights_daily (que já existe no projeto da Aquisição):
-- o token Meta desse projeto está inválido desde julho e não temos chave de escrita
-- (só anon). Esta tabela vive no projeto do stock, alimentada por cron com a chave
-- que já temos. Granularidade: dia × campanha (chega para CAC e investimento).
create table if not exists meta_spend_daily (
  id            serial primary key,
  data          date not null,
  campaign_id   text,
  campaign_name text not null,
  spend         numeric(10,2) not null default 0,
  impressions   integer,
  clicks        integer,
  updated_at    timestamptz default now(),
  unique (data, campaign_name)
);

create index if not exists meta_spend_daily_data_idx on meta_spend_daily (data);

-- ─────────────────────────────────────────────────────────────
-- 4. campanha_oferta — mapeamento campanha -> oferta
-- ─────────────────────────────────────────────────────────────
-- A alocação do custo comercial por oferta (regra existente no dashboard) depende
-- de saber a que oferta pertence cada campanha. Os nomes reais já não são
-- "Slot"/"Venda"/"Funil Aluguer TVDE" — sem este mapa o rateio dá 0 em silêncio.
-- Começa vazia de propósito: preencher com os nomes reais, não inventar.
create table if not exists campanha_oferta (
  campanha text primary key,
  oferta   text not null check (oferta in ('compra','aluguer','slot','comercial'))
);

-- ─────────────────────────────────────────────────────────────
-- 5. Sanidade — depois do backfill, isto deve devolver 0
-- ─────────────────────────────────────────────────────────────
-- vendas sem valor (fechos por apurar):
--   select tipo, count(*) from vendas where valor_total is null and valor_semanal is null group by tipo;
-- carros vendidos sem venda registada:
--   select id, matricula, marca_modelo, preco_venda from carros c
--   where estado = 'Vendido' and not exists (select 1 from vendas v where v.carro_id = c.id);
