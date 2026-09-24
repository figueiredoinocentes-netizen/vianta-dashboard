# Central Vianta — Briefing Completo do Projeto

> Documento para o Claude Code continuar o desenvolvimento.
> Criado a 16/09/2026. Todas as decisões e acessos estão aqui.

---

## 1. O Projeto

**Nome:** Central Vianta

**O que é:** Sistema de gestão de frota interno da Vianta, para substituir o Frota360. Unifica Aquisição (Dashboard, Marketing, Funil) + Operações (Frota, Stock, Manutenções, Pagamentos, Armazém) num único frontend com backend próprio.

**URL produção:** https://vianta-dashboard.netlify.app/operacoes

**Repositório:** https://github.com/figueiredoinocentes-netizen/vianta-dashboard (público, branch master)

**API:** `/.netlify/functions/central?type=motoristas|pagamentos|carros|armazem`

---

## 2. Infraestrutura

### 2.1 Supabase (PostgreSQL)

**Project URL:** https://tuwcllpwvxzmrgrqviqu.supabase.co
**Project Ref:** `tuwcllpwvxzmrgrqviqu`
**Region:** Europe
**GitHub integration:** ligado ao repositório vianta-dashboard

**Chaves:** guardadas apenas no Supabase Dashboard (Settings → API) e nas env vars do Netlify — **nunca** colar valores aqui outra vez (foram removidos a 2026-09-24 depois de terem ficado expostos neste ficheiro, num repo público, e rodados por precaução).

**Tabelas criadas (5):**
- `motoristas` — 53 registos importados
- `pagamentos` — 53 registos importados (split financeiro completo)
- `carros` — 62 registos importados
- `armazem` — 17 registos importados
- `financeiro` — 0 registos (vazia, para criar depois)

**Acesso via SQL:** Dashboard Supabase → SQL Editor. Não há acesso psql remoto.

### 2.2 Netlify

**Site name:** vianta-dashboard
**Site ID:** 9d2906ae-f1c6-466d-9e53-662f6844bb39
**Deploy token:** guardado apenas fora do repo (removido daqui a 2026-09-24 pelo mesmo motivo acima — revogar o antigo se ainda não foi feito).
**Build:** `npm run build` → dist/ (com postbuild.py que copia Lovable bundle + operacoes.html)
**Functions:** `netlify/functions/` (auto-detect)

**Environment variables:** SUPABASE_URL e SUPABASE_SERVICE_KEY estão definidas no Netlify Dashboard (Site settings → Environment variables), não aqui.

### 2.3 Google Sheets (legado, manter por enquanto)

| Sheet | ID | Uso |
|---|---|---|
| DB Carros | 1j5RCxSjd24QlPaquRX7C7eeiHrzPo1c6Wsb0OQWFRjQ | Já migrada p/ Supabase, manter para referência |
| DB Armazém | 1oEKDArSrjfpf8xvpWSJVKcCcTfyZKKz5b5AB8Mh8-u8 | Já migrada p/ Supabase |
| DB Financeiro | (no DB Carros, tab TRANSACOES) | A migrar depois |
| Frota de Viaturas | 1IymwMQtujdohVQPEuIfjxqZvH8EfZTLyp8wW7K7hO00 | Sheet comercial, manter |
| DB Leads Log | 1s9ByVhHXQppWAQsZrgudw4d4GMdzR-qaK0ObPLdRejg | Aquisição, manter |
| DB Transfers (produção) | 1fwGueaZ3otmqO1IODXDv7qe3NayQson1ICgnQHBJc0E | Turismo, manter |

**Google OAuth token (p/ API calls):** `/opt/data/google_token.json`
**Client secret:** `/opt/data/google_client_secret.json`

### 2.4 Transfers App (Turismo)

**Produção:** https://vianta-transfers.netlify.app
**Repositório:** https://github.com/figueiredoinocentes-netizen/interface-tranfers
**Dev (preview):** develop branch → deploy-preview-2--vianta-transfers.netlify.app
**GitHub token:** em ~/.git-credentials (formato https://user:TOKEN@github.com), nome "Hermes Vianta OS"

**API sheets.js:** `/.netlify/functions/sheets?type=transfers|drivers|vehicles|partners|pricing|fleet|armazem`
A função sheets.js tem types extra: `fleet` (escreve DB Carros) e `armazem` (escreve DB Armazém). Útil para operações de escrita no legado.

### 2.5 Frota360 (a descontinuar)

**URL:** https://vianta.frota360.pt/admin
**Credenciais:** francisco.inocentes2000@gmail.com / Vianta_fi2026
**Nota:** dados já migrados para Supabase. Manter ativo enquanto não houver paridade total.

---

## 3. Estrutura do Código

### 3.1 Frontend

**Ficheiro principal:** `public/operacoes.html` (cópia para `operacoes.html` na raiz)
**Build:** postbuild.py copia `public/operacoes.html` para `dist/operacoes.html`

**7 secções implementadas:**
1. 📊 Visão Geral — KPIs (frota ativa, stock, parados, receita/mês)
2. 🚗 Frota Ativa — carros Alugados (exclui Slot)
3. 🏪 Stock — carros Para Venda/Para Aluguer (exclui Slot)
4. 🔧 Manutenções — carros em Manutenção
5. ✅ Check-ins — carros Em Preparação
6. 💰 Pagamentos — chama `/.netlify/functions/central?type=pagamentos`, mostra split financeiro
7. 📦 Armazém — lê CSV da DB Armazém (sheet legado)

**Lovable bundle (Aquisição):** `public/assets/index-Cdosnuq2.js` — bundle minificado, editar diretamente, sem source.

### 3.2 API (Netlify Function)

**Ficheiro:** `netlify/functions/central.js`
**Formato:** ESM (`export const handler`)
**Chama:** Supabase REST API via fetch()

**Endpoints:**
```
GET  /.netlify/functions/central?type=motoristas  → lista todos
GET  /.netlify/functions/central?type=pagamentos  → lista todos
POST /.netlify/functions/central?type=motoristas  → criar {body}
PUT  /.netlify/functions/central?type=pagamentos  → atualizar {id, field, value}
DELETE /.netlify/functions/central?type=motoristas?id=N  → apagar
```

### 3.3 DBs Supabase — Schema

**motoristas:**
```sql
CREATE TABLE motoristas (
  id SERIAL PRIMARY KEY, nome TEXT NOT NULL, email TEXT, telefone TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('Aluguer', 'Slot')), iban TEXT,
  estado TEXT DEFAULT 'Ativo', rating DECIMAL(3,1), contrato TEXT,
  viatura_atual TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**pagamentos:**
```sql
CREATE TABLE pagamentos (
  id SERIAL PRIMARY KEY, motorista_id INTEGER REFERENCES motoristas(id),
  semana TEXT, uber DECIMAL(10,2) DEFAULT 0, bolt DECIMAL(10,2) DEFAULT 0,
  outras_plataformas DECIMAL(10,2) DEFAULT 0, gorjetas DECIMAL(10,2) DEFAULT 0,
  total_bruto DECIMAL(10,2) DEFAULT 0, aluguer DECIMAL(10,2) DEFAULT 0,
  combustivel DECIMAL(10,2) DEFAULT 0, portagens DECIMAL(10,2) DEFAULT 0,
  energia DECIMAL(10,2) DEFAULT 0, seguro DECIMAL(10,2) DEFAULT 0,
  despesas_fixas DECIMAL(10,2) DEFAULT 0, caucao DECIMAL(10,2) DEFAULT 0,
  taxa_bancaria DECIMAL(10,2) DEFAULT 0, financiamento DECIMAL(10,2) DEFAULT 0,
  taxa_admin DECIMAL(10,2) DEFAULT 0, iva DECIMAL(10,2) DEFAULT 0,
  irs_retido DECIMAL(10,2) DEFAULT 0, iva_fatura DECIMAL(10,2) DEFAULT 0,
  liquidio DECIMAL(10,2) DEFAULT 0, estado TEXT DEFAULT 'Pendente',
  data_pagamento TIMESTAMPTZ, comprovativo TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Regras de Negócio

### 4.1 Tipos de Motorista

- **Aluguer** = conduz carro Vianta/investidor, paga renda semanal (ex: 235€, 250€, 290€)
- **Slot** = tem carro próprio, paga 35€/sem + IVA

**Mapeamento Frota360 → Central Vianta:**
- Frota360 "Locatário" → Central Vianta "Aluguer"
- Frota360 "Afiliado" → Central Vianta "Slot"

### 4.2 Split Financeiro (por motorista, personalizável)

Cada motorista tem os seus próprios valores de desconto. O CSV de pagamentos mostra todas as colunas.

**Fórmula:** Líquido = Total Bruto - Aluguer - Combustível - Portagens - Energia - Seguro - Despesas Fixas - Caução - Taxa Bancária - Financiamento - Taxa Admin - IVA - IRS Retido - IVA Fatura + Bónus Manual - Desconto Manual

### 4.3 Proprietário

- "EMPRESA" no Frota360 = "VIANTA" (confirmado pelo Francisco)
- Proprietários individuais (Miguel Brito, Vinod Carsane, etc.) = Investidores
- Slot = o motorista é o dono do carro

---

## 5. Estado Atual (Fase 1 — Completa ✅)

- ✅ Supabase: 5 tabelas, dados importados (53 motoristas, 53 pagamentos, 62 carros, 17 armazém)
- ✅ API central-vianta-api: funcional (GET/POST/PUT/DELETE)
- ✅ Frontend: Central Vianta com 7 secções
- ✅ Módulo Pagamentos: lê da API com split financeiro
- ✅ Netlify env vars configuradas

---

## 6. Próximas Fases

### 🟡 Fase 2 — Motoristas & Contratos

- [ ] **Perfil de motorista no dashboard:** ao clicar num nome na tabela Pagamentos, abrir modal/perfil com:
  - Dados (nome, email, IBAN, tipo, rating)
  - Contrato atual (valor, desde quando)
  - Histórico de pagamentos (últimas semanas)
  - Carro atual (matrícula, modelo)
- [ ] **Contratos:** página/aba para gerir contratos de aluguer e slot
  - Associar motorista a carro
  - Valor do aluguer (personalizável)
  - Data de início, estado (ativo/inativo)
- [ ] **Migrar DB Financeiro** para Supabase (transações de compra/venda de carros)
- [ ] **Recriar páginas da Aquisição** (Dashboard, Marketing, Funil) no novo formato da Central Vianta, mantendo os mesmos dados (DB Leads Log via CSV)

### 🟢 Fase 3 — Faturas + Transfers

- [ ] **Gerar faturas** a partir dos pagamentos (agrupar por motorista + mês)
- [ ] **Integrar Transfers** (Turismo) na Central Vianta
  - Migrar DB Transfers para Supabase
  - Criar interface de gestão de transfers no dashboard
- [ ] **Auth:** login para Zeca, Duarte, Thaís (Google ou magic link via Supabase Auth)
  - Cada user vê apenas as secções relevantes
  - Zeca: Operações (Frota, Pagamentos, Armazém)
  - Thaís: Aquisição (Dashboard, Marketing, Funil)
  - Duarte: Tudo

### 🔵 Fase 4 — Alertas & Desempenho

- [ ] **Alertas:** cron diário que verifica:
  - Pagamentos Pendentes (enviar notificação)
  - Carros em Manutenção há mais de X dias
  - Documentos a expirar (seguros, inspeções)
- [ ] **Rankings:** top motoristas por €/h, rating, corridas (como no Frota360)
- [ ] **Dashboard de desempenho:** gráficos de receita por semana/mês

### ⚪ Fase 5 — Financeiro Avançado (visão, não implementar já)

- [ ] DRE em tempo real
- [ ] Projeção de cash flow
- [ ] Mapa ao vivo com tracking
- [ ] Descontinuação total do Frota360

---

## 7. Notas Importantes

### Convenções de código
- Frontend: HTML + CSS + JS num único ficheiro (standalone)
- API: Netlify Functions com ESM (`export const handler`)
- Publicar: `public/operacoes.html` é a fonte; postbuild.py copia para `dist/`
- Repo tem `"type": "module"` — `.js` são ESM, `.cjs` são CommonJS

### Regras do Francisco (não quebrar)
- **Nunca** escrever na Frota de Viaturas.sheet (produção comercial)
- **Nunca** ler Administrativo/Acessos.gsheet (contém passwords)
- **Nunca** fazer merge para master sem aprovação
- **Mínimo funcional:** construir só o que foi pedido, não adivinhar extras
- Prefere resultados a explicações

### Dados sensíveis
Nenhum valor de credencial vive neste ficheiro (removidos a 2026-09-24 — este repo é público). Localizações apenas:
- Google OAuth token/client secret: `/opt/data/google_token.json`, `/opt/data/google_client_secret.json`
- Git credentials: `~/.git-credentials` (formato `https://user:token@github.com`), token nomeado "Hermes Vianta OS" no GitHub
- Netlify deploy token: guardado fora do repo (Netlify Dashboard → User settings → Applications)

### Para deploy
1. `git push origin master` → Netlify auto-build
2. Esperar deploy-ready (verificar em https://api.netlify.com/api/v1/sites/vianta-dashboard.netlify.app/deploys)
3. Testar em https://vianta-dashboard.netlify.app/operacoes

---

## 8. Contactos

- **Francisco Inocentes** — founder, decisões, tel 934008091
- **Duarte** — gestor frota, Telegram 967449041
- **Thaís** — comercial
- **Pedro Rosa** — gestor transfers/Turismo, pedro.inoc.rosa@gmail.com
- **Zeca** — operações diárias (check-in, pagamentos)

---

*Ficheiro gerado pelo Hermes Agent (Nous Research) a 16/09/2026.*
*Última atualização: Fase 1 completa, Supabase + API + Frontend operacionais.*