-- Margem bruta da viatura gravada na base de dados: o valor final que fica para a Vianta,
-- depois da compra, de todos os custos e da comissão do investidor (tudo s/ IVA).
-- Recalculada por triggers sempre que muda a viatura ou uma linha do Financeiro dela,
-- para quem lê o Supabase (agência, vendas, outras ferramentas) não ter de repetir a conta.
--
-- ⚠️ A mesma conta está em src/lib/operacoes/custos.ts (`resumoCarro`), que o dashboard usa
--    para mostrar o detalhe. Mudar uma obriga a mudar a outra.
--
-- Conta:
--   compra   = faturas tipo 'Compra' (s/ IVA) ou, sem fatura, carros.preco_compra
--   custos   = linhas com valor < 0 que não são 'Compra' (s/ IVA; sem s/ IVA usa o total)
--   receitas = linhas com valor > 0 (s/ IVA; sem s/ IVA usa o total)
--   Venda:   venda s/ IVA = preco_venda / (1 + iva_venda/100) (sem taxa: preco_venda tal como está)
--            resultado = max(venda, receitas) − compra − custos
--   Outros:  resultado = receitas − custos
--   Investidor: margem_bruta = resultado − round(resultado × pct_investidor) / 100
--               sem pct_investidor → NULL (não se sabe a parte da Vianta)
--
-- Corrida no SQL Editor do Central Vianta (tuwcllpwvxzmrgrqviqu) a 2026-11-25.

alter table public.carros add column if not exists margem_bruta numeric;

comment on column public.carros.margem_bruta is
  'Valor final s/ IVA que fica para a Vianta (venda − compra − custos − comissão do investidor). Calculado por trigger; não escrever à mão. NULL = viatura de investidor sem % definida.';

-- Converte texto como "12500", "12.500,50" ou "300€/semana" em número (igual ao toNum do dashboard).
create or replace function public.vianta_to_num(t text) returns numeric
language plpgsql immutable as $$
declare s text;
begin
  if t is null then return 0; end if;
  s := regexp_replace(t, '[^0-9.,-]', '', 'g');
  if position(',' in s) > 0 then s := replace(replace(s, '.', ''), ',', '.'); end if;
  s := substring(s from '^-?[0-9]*\.?[0-9]*');
  if s is null or s in ('', '-', '.', '-.') then return 0; end if;
  return s::numeric;
end $$;

create or replace function public.vianta_margem_bruta(c public.carros) returns numeric
language plpgsql stable as $$
declare
  n_compra int; compra_fat numeric; custos numeric; receitas numeric;
  compra numeric; venda numeric := 0; resultado numeric; pct numeric;
begin
  select count(*) filter (where tipo = 'Compra'),
         coalesce(sum(abs(coalesce(valor_sem_iva, valor))) filter (where tipo = 'Compra'), 0),
         coalesce(sum(-coalesce(valor_sem_iva, valor)) filter (where valor < 0 and tipo is distinct from 'Compra'), 0),
         coalesce(sum(coalesce(valor_sem_iva, valor)) filter (where valor > 0), 0)
    into n_compra, compra_fat, custos, receitas
    from public.financeiro where carro_id = c.id;

  compra := case when n_compra > 0 then compra_fat else public.vianta_to_num(c.preco_compra) end;

  if c.tipo_gestao = 'Venda' then
    if c.iva_venda in (0, 23) then
      venda := round(public.vianta_to_num(c.preco_venda) / (1 + c.iva_venda / 100.0), 2);
    else
      venda := public.vianta_to_num(c.preco_venda);
    end if;
    resultado := (case when venda <> 0 then greatest(venda, receitas) else receitas end) - compra - custos;
  else
    resultado := receitas - custos;
  end if;

  if c.investidor_id is null and coalesce(c.proprietario, '') in ('', 'VIANTA') then
    return round(resultado, 2);
  end if;
  pct := c.pct_investidor;
  if pct is null or pct < 0 or pct > 100 then return null; end if;
  return round(resultado - round(resultado * pct) / 100, 2);
end $$;

create or replace function public.trg_carros_margem_bruta() returns trigger
language plpgsql as $$
begin
  new.margem_bruta := public.vianta_margem_bruta(new);
  return new;
end $$;

drop trigger if exists carros_margem_bruta on public.carros;
create trigger carros_margem_bruta
  before insert or update of preco_venda, iva_venda, preco_compra, pct_investidor, investidor_id, proprietario, tipo_gestao
  on public.carros for each row execute function public.trg_carros_margem_bruta();

create or replace function public.trg_financeiro_margem_bruta() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.carro_id is not null then
    update public.carros c set margem_bruta = public.vianta_margem_bruta(c) where c.id = old.carro_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.carro_id is not null then
    update public.carros c set margem_bruta = public.vianta_margem_bruta(c) where c.id = new.carro_id;
  end if;
  return null;
end $$;

drop trigger if exists financeiro_margem_bruta on public.financeiro;
create trigger financeiro_margem_bruta
  after insert or update or delete on public.financeiro
  for each row execute function public.trg_financeiro_margem_bruta();

-- Preencher todas as viaturas existentes.
update public.carros c set margem_bruta = public.vianta_margem_bruta(c);

notify pgrst, 'reload schema';
