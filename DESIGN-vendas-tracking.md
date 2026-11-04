# Tracking de Vendas ligado ao Stock — Desenho (v3)

*Atualizado 2026-11-03. Estado: **desenho, não implementado**.*

**v3 corrige a v2:** as regras de CAC/investimento não se definem — **já estão definidas no código do dashboard** (`src/hooks/useSheetData.ts` + os 4 dialogs de detalhe). O trabalho não é reinventar métricas; é **trocar a origem dos dados mantendo as fórmulas**.

---

## 1. Regras herdadas (fonte: código, não opinião)

Estas são as regras que já estão implementadas e em uso. Não se alteram.

### Investimento total
`src/hooks/useSheetData.ts` + `InvestmentBreakdownDialog.tsx` / tooltip do card:

> "Soma total do investimento em tráfego pago, equipa comercial e referências."

| Componente | Regra exata |
|---|---|
| **Ads** | Soma das campanhas mapeadas à oferta (`OFFER_CAMPAIGN_MAP`: slot → `Slot`/`Funil Slot`; aluguer → `Aluguer TVDE`, `Aluguer TVDE + Tours`, `Funil Aluguer TVDE`; compra → `Venda`/`Funil Venda`). Sem filtro de oferta → todas as campanhas exceto `Comercial`. |
| **Comercial** | Custo mensal da equipa comercial, alocado **proporcionalmente** à oferta pelo rácio de conversões FB dessa oferta (`comercialTotal × conversoesFB_oferta / conversoesFB_total`). |
| **Referências** | Custo por referência nas **primeiras conversões** orgânicas: **75€** (slot/aluguer) e **200€** (compra). |

### Divisor do CAC
`CACBreakdownDialog.tsx` — "Divisor (primeiras conversões)":

> `investimentoTotal ÷ primeiras conversões (Facebook + Referência)`

- Conta **primeiras conversões** de todas as fontes mapeadas (Paid **e** Orgânico) — não conta renovações nem segundas compras do mesmo cliente.
- Paid/Orgânico decidido pela tabela `source_mapping` (ex: `Facebook`, `fb`, `ig`, `Form LP …` → **Meta Ads / Paid Media**; `Referência`, `Contacto Pessoal`, `email`, `Gestor Frota`, DMs, `ig_organic` → **Orgânico**).

### Restantes KPIs
| KPI | Regra no código |
|---|---|
| Vendas | nº de contratos fechados no período (todos os tipos) |
| Ciclo Venda | dias entre `dataLead` e `dataFecho` |
| Churn | saídas ÷ total |
| Ticket Médio | média dos tickets dos fechados |
| LTV | ticket mensal × meses ativos; **aluguer/slot: semanal × 4** |

### 1.1 Regras acrescentadas (Francisco, 2026-11-03)

Estas não estavam no código porque o modelo antigo não tinha como as exprimir. Passam a valer.

**a) LTV é por cliente, não por venda.**
Quem compra um carro pode depois entrar no Slot. Essa entrada **continua o mesmo cliente** e soma ao LTV dele — não é uma aquisição nova, porque não há investimento de marketing para o mover.

```
LTV(cliente) = margem da compra            (valor_total − preco_compra − custos)
             + Σ (valor_semanal × 4 × meses_ativos)   de todas as linhas aluguer/slot do mesmo cliente
```

Consequência: o LTV deixa de ser calculado linha a linha e passa a ser agregado por `ghl_contact_id`. Um comprador que abre slot tem LTV = margem + slot.

**b) Slot pós-compra não entra no divisor do CAC.**
A regra das "primeiras conversões" passa a ser aplicada por **pessoa**, não por linha: a primeira venda de cada cliente é que conta. Slot de quem já comprou = 0 conversões novas. Slot de quem nunca foi cliente (Segmento B, veio por marketing) = 1 conversão nova, como qualquer outra.

Implementação: identidade = `ghl_contact_id` (contacto do CRM); fallback `motorista_id`.

**c) Retoma — fora de âmbito por agora.**
Compra com retoma não tem regra definida. Quando acontecer, decide-se e acrescenta-se. O desenho assume `valor_total` = preço de venda acordado, sem retoma.

**d) Oferta Investidor — não é um 4º tipo.**
Fica fora de `vendas` e continua a viver onde vive hoje (Planilha Investidores / `financeiro`). Não entra neste tracking nem no LTV daqui.

### Consequência para o desenho
- O denominador do CAC **já é** "nº de vendas" (na forma de primeiras conversões). Não há decisão a tomar.
- O numerador **já inclui** ads + comercial + referências. A minha proposta anterior de "só ads" estava errada — fica sem efeito.
- O slot **já conta** nas vendas. Entra na tabela, com `carro_id` nulo.

---

## 2. Problema (evidência)

| Peça | Estado real verificado |
|---|---|
| Custo Meta outubro/2026 | **€622,96** — 1 campanha `[Lead Gen] [TVDE Drivers]` (Composio, act_293842623) |
| Custo no dashboard | **€0** — sheet de investimento manual, outubro não preenchido |
| `meta_insights_daily` | Congelada a **2026-07-26** — token Meta da dashboard inválido (190/460) |
| Fechos outubro | 3 (Emanuel Coutinho/aluguer 06-10, Bruno José/compra 30-10, Afonso/compra 30-10) — **ticket 0 nos três** |
| Sheet `Base de Dados Drivers Fechados` | 58 linhas, **15 sem ticket** |
| Supabase `carros` | 10 `Vendido`, 7 com `preco_venda` (14.500 → 29.000), sem `data_venda`, `cliente_id` quase sempre nulo |
| GHL Compra/Fechado | **8 de 11 com `monetaryValue` real** (15.000 → 33.000) |
| `financeiro` | 3 registos, todos `Custo`. **Nenhuma receita jamais registada** |

**Causa raiz:** fórmulas certas, **entradas erradas**. O investimento vem de uma sheet manual e os fechos de uma sheet manual com tickets vazios. A venda não existe como entidade.

---

## 3. Modelo de dados

### 3.1 Tabela `vendas` (projeto Supabase do stock)

Cada coluna existe para servir um KPI que já está no ecrã — nada a mais.

```sql
create table vendas (
  id                 serial primary key,
  tipo               text not null check (tipo in ('compra','aluguer','slot')),
  carro_id           integer references carros(id),      -- null no slot (carro é do motorista)
  motorista_id       integer references motoristas(id),
  ghl_contact_id     text not null,                      -- IDENTIDADE (contacto no CRM)
  cliente_nome       text not null,                      -- só apresentação, vem do CRM
  data_lead          date,                               -- ciclo de venda (vem do GHL)
  data_entrada       date not null,                      -- entrega / levantamento
  data_saida         date,                               -- churn
  valor_total        numeric(10,2),                      -- compra
  valor_semanal      numeric(10,2),                      -- aluguer/slot (fonte de verdade)
  fonte              text,                               -- canal CRM -> mapeia Paid/Orgânico
  registado_por      text,                               -- Eduardo, Zeca, ...
  ghl_opportunity_id text unique,
  created_at         timestamptz default now(),
  constraint valor_coerente check (
    (tipo = 'compra'            and valor_total   is not null) or
    (tipo in ('aluguer','slot') and valor_semanal is not null)
  )
);

create unique index vendas_aluguer_aberto_por_carro
  on vendas (carro_id) where data_saida is null and tipo = 'aluguer';

create unique index vendas_slot_aberto_por_motorista
  on vendas (motorista_id) where data_saida is null and tipo = 'slot';
```

**A identidade é o `ghl_contact_id`** — o contacto que já existe no CRM. Não se cria registo novo, não se pede NIF, não se pede nada ao comercial: a venda herda o contacto do lead que já está no GHL. Várias vendas com o mesmo `ghl_contact_id` = o mesmo cliente (é isto que faz o LTV agregar e a "primeira conversão" contar uma vez só).

Fallback quando a venda não vier do CRM (walk-in, contacto direto): `motorista_id`. Se nem isso, a venda fica sem identidade e não entra na contagem de conversões — aparece no bloco "sem atribuição", nunca é inventada.

**`fonte` também não é decorativo** — é o que alimenta o `source_mapping` (Paid vs Orgânico), que decide se a conversão entra no divisor e se gera custo de referência.

### 3.2 Fora da tabela
| Campo | Porquê fora |
|---|---|
| `campanha`, `adset`, `criativo` | O CAC não é atribuído por venda. `fonte` chega para o Paid/Orgânico. |
| `valor_mensal` | Calculado (`valor_semanal * 4`). Duas verdades é o que já nos trouxe aqui. |
| `cac` | Métrica derivada, nunca guardada. |

### 3.3 Ajustes em `carros`
| Campo | Agora | Passa a |
|---|---|---|
| `preco_venda` | `text` | `numeric(10,2)` |
| `data_venda` | não existe | `date` (espelho de `vendas.data_entrada` quando compra) |
| `cliente_id` | quase sempre null | preenchido pela venda |

---

## 4. Fluxo operacional (dois donos, dois gatilhos)

Ambos nascem **do carro**, no módulo Operações. O formulário só pede o que o sistema não sabe.

### 4.1 Compra — **Eduardo**
```
Eduardo entrega o carro ao cliente
   ↓  abre a plataforma → carro → "Registar venda"
   ↓  escolhe o cliente na lista do CRM (contacto do lead, já existe)
   ↓  valor fechado + data de entrega
   ↓  cria `vendas` (tipo=compra) + carro → "Vendido" + data_venda
```
Eduardo só escreve **dois dados**: valor e data. O cliente já lá está — não se cria registo, não se pede NIF. Sem valor e sem cliente o carro **não muda** para "Vendido".

### 4.2 Aluguer — **Zeca**
```
Cliente paga caução, integração na frota, levanta o carro
   ↓  abre a plataforma → carro → "Registar aluguer"
   ↓  escolhe o motorista (= contacto do CRM); valor semanal já pré-preenchido de `carros.valor_aluguer_semanal`
   ↓  cria `vendas` (tipo=aluguer) + carro → "Alugado" + motorista associado
```
O Zeca só corrige o valor se o contrato for diferente. Churn = preencher `data_saida`, nunca apagar a linha.

### 4.3 Slot
`carro_id = null`, `motorista_id` obrigatório. Dois casos distintos:

- **Slot de frota** (motorista com carro próprio) — contrato novo.
- **Slot pós-compra** (quem comprou carro à Vianta e fica na frota) — `cliente_id` já existe, logo é **extensão de LTV**, não aquisição nova. O registo deve reaproveitar o cliente em vez de criar um novo.

**Quem regista está por definir** (ponto aberto 1).

---

## 5. O que muda realmente (as fórmulas ficam)

| Camada | Antes | Depois |
|---|---|---|
| Investimento ads | Google Sheet, tabs por campanha, preenchidas à mão | `meta_insights_daily` alimentada por cron Composio |
| Fechos / tickets | Google Sheet `Base de Dados Drivers Fechados` | tabela `vendas` |
| Cálculo CAC / LTV / ticket | `useSheetData.ts` | **igual, só muda a origem** |

**Detalhe de implementação que isto obriga:** a fórmula atual aloca o comercial pela campanha→oferta (`OFFER_CAMPAIGN_MAP`, nomes fixos). As campanhas reais no Meta já não se chamam `Slot`/`Venda` — chamam-se `[Lead Gen] [TVDE Drivers]`. Sem uma **tabela de mapeamento campanha → oferta**, o rácio por oferta parte-se em silêncio (mostra 0 em vez de dar erro). É o único ponto que pode falhar sem avisar.

---

## 6. Faseamento

| Fase | Trabalho | Tier |
|---|---|---|
| F1 | Cron Composio → `meta_insights_daily`; criar `vendas`; backfill (10 carros `Vendido` + 11 oportunidades Compra/Fechado com `updatedAt`) | 0 |
| F2 | Registo no Operações (Eduardo/Zeca) + bloqueio: não muda estado sem venda | 1 (mexe no fluxo humano) |
| F3 | `useSheetData` lê `vendas` + `meta_insights_daily`; sheet fica read-only | 0 |
| F4 | Mapeamento campanha→oferta configurável; reconciliação semanal | 0 |

---

## 7. Limites assumidos

- **Histórico:** fechos antigos sem campanha/criativo e com datas duvidosas. O backfill recupera o que existe; não se reconstrói o passado.
- **`carros_estados_log`** tem `desde` = data de importação (14-10-2026) na maioria dos `Vendido`. Não serve como `data_entrada`.
- **Sheet legacy** fica read-only até F3.
- **Duas bases Supabase:** Aquisição/Lovable → `mowptkpnjlttbqgjtena` (`meta_insights_daily`, `raw_leads`, `source_mapping`); stock/Operações → `tuwcllpwvxzmrgrqviqu` (`carros`, `financeiro`, `vendas`). KPI custo×venda cruza dois projetos — resolve-se no endpoint.
- **Meta:** conta act_293842623. A act_1333267811321182 está vazia.

---

## 8. Pontos abertos

**Fechados (2026-11-03):**
- Retoma — fora de âmbito até acontecer.
- Oferta Investidor — não é 4º tipo, fica fora.
- Slot — entra, com regra de LTV definida acima.
- Denominador do CAC, composição do investimento, entrada do slot — já estavam no código.

**Aberto (não bloqueia F1):**
1. **Quem regista o slot** — Duarte, Thaís, ou continua no Zeca?

**Nota sobre a identidade:** a agregação por `ghl_contact_id` só falha se o CRM tiver **contactos duplicados** da mesma pessoa (ex: "Bruno José" criado duas vezes). Nesse caso o LTV parte-se em dois. A correção é fazer merge no GHL — não inventar uma segunda chave nem pedir dados ao comercial.
