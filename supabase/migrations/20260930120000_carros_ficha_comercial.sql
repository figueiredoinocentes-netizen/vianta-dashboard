-- Ficha comercial da viatura: passa a tabela `carros` a ser a fonte única
-- (substitui a sheet "Frota de Viaturas"). Só acrescenta colunas; não altera
-- nem apaga nada do que já existe.
--
-- Tipos em texto de propósito, tal como já é o caso de `ano`, `kms_atuais` e
-- `preco_venda` (a sheet tinha formatos misturados: "75 000,00", "2026/02/11").

alter table public.carros
  add column if not exists versao text,
  add column if not exists cor text,
  add column if not exists caixa text,
  add column if not exists autonomia_km text,
  add column if not exists categorias_tvde text,
  add column if not exists caucao text,
  add column if not exists garantia text,
  add column if not exists fim_elegibilidade_tvde text,
  add column if not exists docs_link text,
  add column if not exists fotos_link text,
  add column if not exists fotos jsonb not null default '[]'::jsonb,
  add column if not exists obs text,
  -- Internos (não mostrar ao cliente)
  add column if not exists data_entrada text,
  add column if not exists data_saida text,
  add column if not exists custo_aquisicao_com_iva text,
  add column if not exists custo_aquisicao_sem_iva text,
  add column if not exists despesas text,
  add column if not exists margem_realizada text;

comment on column public.carros.fotos is 'URLs das fotos da viatura (Supabase Storage), na ordem de apresentação. A capa continua em foto_url.';
