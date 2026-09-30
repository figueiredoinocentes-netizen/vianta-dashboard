import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const { drivers, investmentEntries, kpis, fontes, ghl, rawLeads, movements, config, playbooks } = context || {};

    // ===== Contexto temporal (Europe/Lisbon) =====
    const TZ = "Europe/Lisbon";
    const now = new Date();
    const nowISO = now.toISOString();

    const fmtYMD = (d: Date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(d);
      const y = parts.find(p => p.type === "year")!.value;
      const m = parts.find(p => p.type === "month")!.value;
      const day = parts.find(p => p.type === "day")!.value;
      return `${y}-${m}-${day}`;
    };

    const todayLisbon = fmtYMD(now);
    const [yStr, mStr, dStr] = todayLisbon.split("-");
    const Y = parseInt(yStr), M = parseInt(mStr), D = parseInt(dStr);

    // Helpers usando UTC noon para evitar DST
    const ymdFromYMD = (y: number, m: number, d: number) =>
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const addDaysYMD = (ymd: string, delta: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + delta, 12));
      return ymdFromYMD(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    };
    const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

    const mesInicio = ymdFromYMD(Y, M, 1);
    const mesFim = ymdFromYMD(Y, M, lastDayOfMonth(Y, M));
    const prevY = M === 1 ? Y - 1 : Y;
    const prevM = M === 1 ? 12 : M - 1;
    const mesAnteriorInicio = ymdFromYMD(prevY, prevM, 1);
    const mesAnteriorFim = ymdFromYMD(prevY, prevM, lastDayOfMonth(prevY, prevM));

    // Semana: segunda a domingo
    const todayDate = new Date(Date.UTC(Y, M - 1, D, 12));
    const dow = todayDate.getUTCDay(); // 0=Dom..6=Sab
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const semanaInicio = addDaysYMD(todayLisbon, diffToMonday);
    const semanaFim = addDaysYMD(semanaInicio, 6);

    const d7Inicio = addDaysYMD(todayLisbon, -6);
    const d30Inicio = addDaysYMD(todayLisbon, -29);
    const d90Inicio = addDaysYMD(todayLisbon, -89);
    const ontem = addDaysYMD(todayLisbon, -1);

    const weekdayLisbon = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, weekday: "long" }).format(now);
    const monthLisbon = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, month: "long" }).format(now);
    const yearLisbon = String(Y);

    const temporalSection = `
## Contexto Temporal (FONTE DA VERDADE para datas)
- Data/hora atual (UTC ISO): ${nowISO}
- Hoje (Europe/Lisbon): ${weekdayLisbon}, ${todayLisbon}
- Ontem: ${ontem}
- Mês atual: ${monthLisbon} de ${yearLisbon} (${mesInicio} a ${mesFim})
- Mês anterior: ${mesAnteriorInicio} a ${mesAnteriorFim}
- Semana atual (seg–dom): ${semanaInicio} a ${semanaFim}
- Últimos 7 dias: ${d7Inicio} a ${todayLisbon}
- Últimos 30 dias: ${d30Inicio} a ${todayLisbon}
- Últimos 90 dias: ${d90Inicio} a ${todayLisbon}
`;

    let ghlSection = '';
    if (ghl) {
      ghlSection = `
## Dados do Funil CRM (GoHighLevel)

### Pipelines e Fases
${JSON.stringify(ghl.pipelines || [], null, 0)}

### Oportunidades (lista geral, campos mínimos para estatísticas)
${JSON.stringify(ghl.opportunities || [], null, 0)}

### Oportunidades COM NOTAS (contexto rico já agrupado: lead + fase + notas)
${JSON.stringify(ghl.opportunitiesWithNotes || [], null, 0)}

### Notas indexadas por NOME (lowercase) — usar este índice como atalho direto
${JSON.stringify(ghl.notesByName || {}, null, 0)}
`;
    }

    let configSection = '';
    if (config) {
      configSection = `
## Regras de Configuração (FONTE DA VERDADE — usa SEMPRE estas regras)

### Regras de Qualificação por Pipeline (MQL / Contactados / SQL)
Para cada pipeline, cada categoria contém a lista \`stages\` JÁ EXPANDIDA com aliases.
Um lead conta para a categoria se a sua \`stage\` (em \`movements\` ou \`opportunities.stageName\`) estiver nessa lista.
Para \`contactados\`, se \`prefixoExcluir\` estiver definido, ignora leads cuja stage comece por esse prefixo.

${JSON.stringify(config.qualificationRules || {}, null, 0)}

### Funil Visual Canónico (etapas atuais + aliases históricos)
${JSON.stringify(config.funnelVisual || {}, null, 0)}

### Mapeamento de Fontes (fonte_crm → canal_dashboard / tipo)
Usa este mapa para traduzir a \`fonte\` dos RAW_LEADS antes de agregar por canal.

${JSON.stringify(config.sourceMapping || [], null, 0)}
`;
    }

    let playbooksSection = '';
    if (Array.isArray(playbooks) && playbooks.length > 0) {
      const blocks = playbooks.map((p: any) => {
        return `### SOP — Pipeline ${p.pipeline}${p.title ? ` (${p.title})` : ''}\nÚltima sincronização: ${p.synced_at}\n\n${p.content || ''}`;
      }).join('\n\n---\n\n');
      playbooksSection = `
## Processo Comercial — Manuais (SOPs) por Pipeline (FONTE DA VERDADE)

Para perguntas sobre **como funciona o processo comercial**, **o que fazer numa fase específica do funil**, **automações**, **scripts/mensagens a enviar**, **regras de qualificação operacional**, **timing de follow-ups**, **passos a seguir** ou **políticas internas de venda**, usa EXCLUSIVAMENTE os SOPs abaixo. Cita a secção/passo do SOP em que te baseias na resposta.

Se a pergunta for sobre o processo de uma pipeline para a qual não há SOP carregado, di-lo claramente em vez de inventar.

${blocks}
`;
    }

    const systemPrompt = `És o Assistente Vianta, um analista de dados especializado na operação da Vianta — empresa de gestão de frota TVDE e serviços de Transfers/Tours.

Tens acesso completo aos dados do dashboard e ao CRM (GoHighLevel). Responde SEMPRE em português de Portugal.
${temporalSection}
## Dados de Drivers (motoristas fechados)
${JSON.stringify(drivers || [], null, 0)}

## Dados de Investimento (por campanha e mês)
${JSON.stringify(investmentEntries || [], null, 0)}

## KPIs Atuais
${JSON.stringify(kpis || {}, null, 0)}

## Fontes de Aquisição Disponíveis
${JSON.stringify(fontes || [], null, 0)}
${ghlSection}${configSection}${playbooksSection}
## Leads de Marketing (RAW_LEADS)
Dados individuais de leads captados (campos: id, nome, oferta, subcategoria, dataRegisto, fonte, landingPage, campanha, adSet, criativo):
${JSON.stringify(rawLeads || [], null, 0)}

## Movimentos de Leads (RAW_EVENTS)
Eventos de movimentação de leads entre fases do funil (campos: id, nome, pipeline, stage, date):
${JSON.stringify(movements || [], null, 0)}

## Instruções CRÍTICAS — Regras de Configuração
- **Sempre que a pergunta envolva contagens de MQL, SQL, Contactados, leads numa fase do funil, ou atribuição de fontes/canais**, usa EXCLUSIVAMENTE as definições em \`config.qualificationRules\`, \`config.funnelVisual\` e \`config.sourceMapping\`. Estas são a fonte da verdade.
- Para contar **SQL** de uma pipeline (ex: Aluguer): considera apenas leads cuja \`stage\` (em \`movements\` ou \`opportunities.stageName\`) esteja em \`config.qualificationRules["Aluguer"].sql.stages\`. Esta lista já inclui aliases — não acrescentes critérios próprios.
- Para contar **MQL**: usa \`config.qualificationRules[pipeline].mql.stages\`.
- Para contar **Contactados**: usa \`config.qualificationRules[pipeline].contactados.stages\`. Se \`prefixoExcluir\` estiver definido (não vazio), exclui leads cuja stage comece por esse prefixo.
- Para análises por **canal/fonte**: traduz \`fonte\` (em RAW_LEADS) usando \`config.sourceMapping\` antes de agregar. Quando não há mapeamento, mantém a fonte original e indica isso.
- **Nunca inventes critérios próprios de qualificação.** Se a regra não estiver configurada para uma pipeline, di-lo claramente em vez de estimar com regras alternativas.
- **Datas e expressões temporais relativas** (hoje, ontem, esta semana, este mês, último trimestre, etc.): usa EXCLUSIVAMENTE os intervalos do bloco *Contexto Temporal* acima. Nunca assumas o ano ou mês a partir do teu treino.
- Ao filtrar \`dataRegisto\`, \`dataFecho\`, \`date\` (movimentos) ou \`dateAdded\` (notas), compara em formato \`YYYY-MM-DD\` com as datas calculadas no *Contexto Temporal*.

## Instruções gerais
- Quando a pergunta for analítica (ex: "quantos drivers entraram em janeiro"), responde com base nos dados acima, incluindo nomes e detalhes quando relevante.
- Quando a pergunta for estratégica (ex: "como aumentar drivers de aluguer"), dá sugestões concretas baseadas nos padrões dos dados.
- Quando a pergunta for sobre o funil/CRM (ex: "que leads estão na fase Visita Marcada"), usa os dados de oportunidades do GoHighLevel.
- Quando perguntarem sobre **notas** de um lead/contacto: procura PRIMEIRO em \`notesByName[nome.toLowerCase()]\` (índice direto). Se não houver match exato, procura em \`opportunitiesWithNotes\` por correspondência parcial de \`name\` ou \`contactName\` (case-insensitive). Apresenta o \`body\` de cada nota com a respetiva \`dateAdded\` formatada. Nunca digas que não tens acesso às notas se o nome existir nestes índices.
- Quando perguntarem sobre leads de marketing, fontes de aquisição, campanhas, landing pages ou fases do funil de marketing, usa os dados de RAW_LEADS e RAW_EVENTS.
- Os RAW_EVENTS mostram por que fases cada lead passou e quando. Cruza com RAW_LEADS pelo campo "id" ou "nome".
- Usa formatação markdown: listas, negrito, tabelas quando apropriado.
- Sê conciso mas completo. Menciona números e nomes concretos.
- O campo "tipoOferta" pode ser: slot, aluguer, compra.
- O campo "dataFecho" é a data de fecho/entrada do driver. "dataSaida" indica churn.
- O campo "fonte" indica de onde veio o lead (campanha de aquisição).
- No CRM, "status" pode ser: open, won, lost, abandoned. "stageName" é a fase atual no pipeline.`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://dashboardaquisicaovianta.lovable.app",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiados pedidos. Tenta novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de AI esgotados. Adiciona créditos na workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
