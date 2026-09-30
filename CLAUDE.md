# Claude Code — Prompt para continuar a Central Vianta

Lê o ficheiro `briefing-central-vianta-completo.md` na raiz deste repositório. Ele contém toda a informação necessária:

- Infraestrutura (Supabase URL + service key, Netlify token, env vars)
- Schema das tabelas Supabase (motoristas, pagamentos, carros, armazém, financeiro)
- Estrutura do frontend (src/pages/operacoes/) e API (netlify/functions/central.js)
- Regras de negócio (tipos de motorista, split financeiro, proprietários)
- Fases 1 a 5 do projeto
- Estado atual (Fase 1 completa: dados importados, API funcional, frontend com 7 secções)
- Próximos passos (Fase 2)

## O que fazer primeiro

1. Lê `briefing-central-vianta-completo.md` na íntegra
2. Verifica o estado atual: API em `/.netlify/functions/central`, frontend em `src/pages/operacoes/`
3. Testa a API: `curl -s "https://vianta-dashboard.netlify.app/.netlify/functions/central?type=motoristas"`
4. Avança para a Fase 2: Perfil de motoristas, contratos, históricos

## Regras importantes

- **Nunca** escrever na Frota de Viaturas.gsheet (produção comercial)
- **Nunca** ler Administrativo/Acessos.gsheet (passwords)
- **Nunca** fazer merge para master sem aprovação do Francisco
- O repo tem `"type": "module"` — `.js` são ESM, usar `export const handler`
- Para funções Netlify, retornar `{ statusCode, headers, body }` — não `new Response()`
- Preferir Supabase REST API via fetch() a usar SDKs pesados
- Publicar: `npm run build` (Vite) compila a app React de `src/` para `dist/`. **Uma só app**: Aquisição em `/` e Operações em `/operacoes/*` (páginas React em `src/pages/operacoes/`, pop-ups em `src/components/operacoes/`, dados em `src/hooks/useOperacoes.ts` + `src/lib/operacoes/`). O antigo `operacoes.html` standalone foi removido (unificação na branch `testes`). **Nunca editar bundles compilados**, editar `src/`.
- Precisa de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ambiente do Netlify; localmente em `.env.local`, ignorado pelo git)
