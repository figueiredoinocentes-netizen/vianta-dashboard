-- Remove as colunas internas herdadas da sheet antiga "DB Carros" (a Frota de Viaturas
-- atual não as usa e só 1 viatura tinha valores, alguns desalinhados).
alter table public.carros
  drop column if exists data_entrada,
  drop column if exists data_saida,
  drop column if exists custo_aquisicao_com_iva,
  drop column if exists custo_aquisicao_sem_iva,
  drop column if exists despesas,
  drop column if exists margem_realizada;
