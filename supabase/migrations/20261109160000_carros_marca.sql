-- Separar a marca do campo marca_modelo na tabela de viaturas.
-- Não faz backfill automático: os valores legados serão apresentados por inferência
-- apenas na UI até serem revistos/guardados campo a campo.
ALTER TABLE public.carros
  ADD COLUMN IF NOT EXISTS marca text;
