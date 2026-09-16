# Handoff Claude Code → Hermes Agent — 16/09/2026

> Contexto: o Francisco pediu uma avaliação à Fase 1 do Central Vianta (ver `briefing-central-vianta-completo.md`). Este documento resume o que foi encontrado, o que já foi corrigido (PR #2, branch `dev`) e o que fica pendente para a próxima sessão do Hermes.

---

## 1. Erros encontrados na Fase 1 (antes desta correção)

A Fase 1 estava marcada como "Completa ✅" no briefing, mas a avaliação encontrou:

1. **Frota Ativa, Stock, Manutenções, Check-ins e Armazém liam da Google Sheet legada (CSV público), não do Supabase.** As tabelas `carros` (62 registos) e `armazem` (17 registos) tinham sido importadas para o Supabase mas o frontend (`operacoes.html`) nunca as consultava — dados migrados mas nunca "ligados".
2. **As escritas de estado** (`editStatus`/`setStatus`) iam para a função Netlify de **outra app** — `vianta-transfers.netlify.app/.netlify/functions/sheets?type=fleet` — escrevendo na sheet legada em vez do Supabase. Acoplamento frágil entre dois repos distintos.
3. **Os formulários "Nova Viatura" e "Novo Item" eram decorativos.** O submit fazia só `alert('...registada. DB atualizada.')` e fechava o modal — não chamava nenhuma API. Ninguém reparava porque nunca dava erro.
4. **Bug em Pagamentos**: a coluna "Motorista" mostrava o `motorista_id` em bruto em vez do nome (faltava o join com `motoristas`). O email e o tipo também vinham sempre em branco pelo mesmo motivo — a tabela `pagamentos` não tem essas colunas, só `motorista_id`.
5. **Segurança da API (`central.js`)**: sem autenticação nenhuma — GET/POST/PUT/DELETE completamente públicos — e CORS `Access-Control-Allow-Origin: '*'`. Qualquer pessoa com o URL conseguia ler emails/IBANs/telefones dos 53 motoristas ou escrever/apagar registos de produção.
6. Menor: os erros da API devolviam ao cliente o texto bruto de erro do Supabase (pequena fuga de informação interna).

## 2. O que foi corrigido — [PR #2](https://github.com/figueiredoinocentes-netizen/vianta-dashboard/pull/2) (branch `dev`, ainda por aprovar/merge)

Por decisão do Francisco, **autenticação real da API fica para a Fase 3** (Supabase Auth) — não foi implementado nenhum token temporário. Foi feito:

- **`public/operacoes.html`** (+ cópia `operacoes.html` na raiz):
  - `fetchData()` reescrita: carrega `carros`, `armazem` e `motoristas` via `central?type=...` em vez das duas Google Sheets CSV.
  - Todos os `render*()` (Visão Geral, Frota, Stock, Manutenções, Check-ins, Armazém) adaptados aos nomes de coluna reais do Supabase (`marca_modelo`, `kms_atuais`, `tipo_gestao`, `estado`, etc. em vez das chaves com acentos/espaços da sheet).
  - `editStatus`/`setStatus`/`updateCell` passam a fazer `PUT central?type=carros` com `{id, field:'estado', value}` em vez de chamar a função do `vianta-transfers`.
  - "Nova Viatura" → `handleNovaViatura()`: `POST central?type=carros` real.
  - "Novo Item" → `handleNovoItem()`: `POST central?type=armazem` real.
  - Pagamentos: cruza `motorista_id` com o mapa de `motoristas` para mostrar nome, email e tipo corretos.
- **`netlify/functions/central.js`**:
  - CORS deixa de ser `*` — só aceita a origem de produção (`vianta-dashboard.netlify.app`) e subdomínios de preview/branch do mesmo site (`resolveOrigin()`).
  - Erros do Supabase deixam de ser expostos ao cliente (mensagem genérica; detalhe fica só no `console.error` da function).

**Testado**: corri o `handler` diretamente fora do Netlify com as credenciais reais — GET nas 4 tabelas confirma contagens (53 motoristas, 53 pagamentos, 62 carros, 17 armazém), e um ciclo completo `POST → GET → PUT → DELETE` num item de armazém de teste (criado e apagado, contagem voltou a 17 no final).

## 3. Pendente / não resolvido

- **Campo "Cor" do formulário "Nova Viatura" não é enviado** — a tabela `carros` não tem essa coluna. Se for suposto existir, precisa de `ALTER TABLE carros ADD COLUMN cor TEXT` no Supabase primeiro.
- **Deploy preview do PR #2 está pendente de aprovação manual no Netlify** (`untrusted_flow: "review"`) porque o PR veio de um fork (`InoPablo/vianta-dashboard`) — a conta GitHub `InoPablo` perdeu acesso de escrita direto a `figueiredoinocentes-netizen/vianta-dashboard` na migração de conta. Vale a pena resolver o acesso GitHub como tarefa à parte (dar escrita a uma conta que o Claude Code/Hermes possam usar), para não depender de forks em PRs futuros.
- **`master` está com o build partido no Netlify** — 2 deploys falharam hoje por volta das 15:50–15:51 UTC, no commit `272ae23` ("add CLAUDE.md"), erro `Build script returned non-zero exit code: 2`. O deploy-preview deste PR (branch `dev`) falhou com o **mesmo erro exato**, mesmo depois do Francisco aprovar o build no Netlify (`untrusted_flow: review`). **Confirmado que não é o código deste PR**: corri localmente os 3 passos do `npm run build` (`tsc -b`, `vite build`, `scripts/postbuild.py`) com as alterações desta branch — os 3 passam com exit code 0, sem nenhum erro. É um problema do ambiente/pipeline de build do próprio Netlify, pré-existente e a afetar `master` também. Suspeita não confirmada (sem acesso ao log completo do build via API): o `postbuild.py` depende de `python3`, que pode não estar disponível no ambiente de build atual do Netlify. **Deixado para o Hermes investigar** — por decisão do Francisco, não mexi na configuração de build partilhada.
- **API `central.js` continua sem autenticação real** — só CORS restrito. Fica para a Fase 3 (login Zeca/Duarte/Thaís via Supabase Auth), por decisão explícita do Francisco.

## 4. Próximos passos sugeridos

1. Francisco aprova o build do PR #2 no Netlify (ou revê o diff e faz merge direto) — ver secção 3 do briefing para o link dos deploys.
2. Diagnosticar e corrigir o build falhado em `master` (commit `272ae23`).
3. Resolver o acesso de escrita ao repo para a conta usada pelo Claude Code, para futuras alterações não precisarem de fork+PR externo.
4. Continuar a Fase 2 conforme `briefing-central-vianta-completo.md` secção 6: perfil de motorista (modal), página de Contratos, migrar DB Financeiro para Supabase, recriar páginas de Aquisição no novo formato.

---
*Escrito pelo Claude Code a 16/09/2026, depois de avaliar e corrigir a Fase 1 a pedido do Francisco.*
