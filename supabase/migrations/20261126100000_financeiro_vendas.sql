-- Registo de vendas de viaturas no Financeiro (2026-11-26).
-- A venda é um movimento tipo 'Venda' (valor positivo), criado logo no fecho do negócio como
-- 'provisorio'; no fecho do mês associa-se a fatura de venda (n_documento + ficheiro) e passa a 'validado'.
-- ghl_lead_id = coluna "ID" da aba RAW_LEADS da sheet DB Leads Log: liga a venda à lead e ao marketing.
-- Corrida no SQL Editor do Central Vianta (tuwcllpwvxzmrgrqviqu).

alter table public.financeiro
  add column if not exists ghl_lead_id text,
  add column if not exists estado_validacao text,
  add column if not exists validado_em timestamptz;

alter table public.financeiro drop constraint if exists financeiro_estado_validacao_check;
alter table public.financeiro
  add constraint financeiro_estado_validacao_check
  check (estado_validacao is null or estado_validacao in ('provisorio', 'validado'));

comment on column public.financeiro.ghl_lead_id is 'ID da lead no GHL (coluna ID da aba RAW_LEADS da DB Leads Log). Só nas vendas.';
comment on column public.financeiro.estado_validacao is 'Vendas: provisorio (registada no fecho do negócio) ou validado (fatura associada no fecho do mês).';

-- Margem: havendo movimento de venda, a receita é a registada (todas as receitas da viatura);
-- só sem venda registada se usa o preço da ficha. Antes usava-se sempre o maior dos dois.
create or replace function public.vianta_margem_bruta(c public.carros) returns numeric
language plpgsql stable as $$
declare
  n_compra int; n_venda int; compra_fat numeric; custos numeric; receitas numeric;
  compra numeric; venda numeric := 0; resultado numeric; pct numeric;
begin
  select count(*) filter (where tipo = 'Compra'),
         count(*) filter (where tipo = 'Venda'),
         coalesce(sum(abs(coalesce(valor_sem_iva, valor))) filter (where tipo = 'Compra'), 0),
         coalesce(sum(-coalesce(valor_sem_iva, valor)) filter (where valor < 0 and tipo is distinct from 'Compra'), 0),
         coalesce(sum(coalesce(valor_sem_iva, valor)) filter (where valor > 0), 0)
    into n_compra, n_venda, compra_fat, custos, receitas
    from public.financeiro where carro_id = c.id;

  compra := case when n_compra > 0 then compra_fat else public.vianta_to_num(c.preco_compra) end;

  if c.tipo_gestao = 'Venda' then
    if n_venda > 0 then
      resultado := receitas - compra - custos;
    else
      if c.iva_venda in (0, 23) then
        venda := round(public.vianta_to_num(c.preco_venda) / (1 + c.iva_venda / 100.0), 2);
      else
        venda := public.vianta_to_num(c.preco_venda);
      end if;
      resultado := (case when venda <> 0 then greatest(venda, receitas) else receitas end) - compra - custos;
    end if;
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

update public.carros c set margem_bruta = public.vianta_margem_bruta(c);

notify pgrst, 'reload schema';
