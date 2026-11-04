/**
 * Registo estático da Órbita 3D do AI OS.
 *
 * Tudo o que o snapshot (aios-state.json) ainda NÃO traz: documentos do
 * vianta-brain (com o ID do Drive para "abrir documento"), tabelas, apps,
 * detalhes das integrações e ligações que não se deduzem automaticamente.
 * Perfis, rotinas, skills, gateways e health vêm do snapshot ao vivo
 * (ver src/lib/aios/orbitGraph.ts). Nunca colocar segredos aqui.
 */

export const AREAS = [
  ['comercial', 'Comercial', '#3987e5'],
  ['marketing', 'Marketing', '#d95926'],
  ['turismo', 'Turismo', '#199e70'],
  ['conhecimento', 'Conhecimento', '#c98500'],
  ['web', 'Web', '#d55181'],
  ['dados', 'Dados', '#008300'],
  ['sistema', 'Sistema', '#9085e9'],
] as const;
export type AreaId = (typeof AREAS)[number][0];
export const AIDX: Record<string, number> = {};
export const ACOL: Record<string, string> = {};
export const ANAME: Record<string, string> = {};
AREAS.forEach((a, i) => { AIDX[a[0]] = i; ACOL[a[0]] = a[2]; ANAME[a[0]] = a[1]; });

export type NodeType = 'hub' | 'agent' | 'human' | 'folder' | 'file' | 'script' | 'data' | 'skill' | 'cron' | 'integ' | 'app';

export const TYPE_NAME: Record<NodeType, string> = {
  hub: 'núcleo', agent: 'agente', human: 'humano', folder: 'pasta', file: 'ficheiro',
  script: 'script', data: 'dados', skill: 'skill', cron: 'rotina', integ: 'integração', app: 'app',
};
/** Grupos dos botões "mostrar tipos" (pasta e script andam com ficheiro, humano com agente). */
export const TYPE_GROUP: Record<NodeType, string> = {
  hub: 'core', agent: 'agent', human: 'agent', folder: 'file', file: 'file',
  script: 'file', data: 'data', skill: 'skill', cron: 'cron', integ: 'integ', app: 'app',
};
export const SIZE: Record<NodeType, number> = {
  hub: 30, agent: 20, human: 11, folder: 11, file: 6, script: 8, data: 8, skill: 10, cron: 10, integ: 11, app: 14,
};
/** Nível na hierarquia dos pop-ups: abaixo abre ao lado, acima substitui. */
export const RANK: Record<NodeType, number> = {
  hub: 0, human: 1, agent: 2, folder: 2, cron: 3, skill: 4, integ: 4, app: 4, script: 4, data: 5, file: 5,
};
export const GROUP_ORDER: NodeType[] = ['hub', 'agent', 'human', 'cron', 'skill', 'folder', 'file', 'script', 'data', 'integ', 'app'];
export const GROUP_NAME: Record<NodeType, string> = {
  hub: 'Núcleo', agent: 'Agentes', human: 'Pessoas', cron: 'Rotinas', skill: 'Skills', folder: 'Pastas',
  file: 'Ficheiros', script: 'Scripts e estado', data: 'Tabelas de dados', integ: 'Integrações', app: 'Apps',
};

export type Fact = [string, string, boolean?]; // [chave, valor, mono]
export type Link = [string, string];            // [rótulo, url]

export interface RegNode {
  id: string;
  label: string;
  type: NodeType;
  area: AreaId;
  desc: string;
  facts?: Fact[];
  links?: Link[];
  /** chave em state.integrations (ou 'ghl' / 'supabase' / 'composio') para o health ao vivo */
  healthKey?: string;
  /** chave(s) em state.supabase para mostrar contagens */
  countKeys?: string[];
}

const SB = 'https://supabase.com/dashboard/project/';
const SB_MAIN = 'tuwcllpwvxzmrgrqviqu';
const SB_AQ = 'mowptkpnjlttbqgjtena';
const drive = (id: string): Link => ['Abrir documento no Drive', `https://drive.google.com/file/d/${id}/view`];
const brain = (p: string): Fact => ['Caminho no Hermes', `/opt/data/vianta-brain/${p}`, true];

export const HUMANS = [
  { name: 'francisco', area: 'sistema' as AreaId, desc: 'Perfil humano: workspace do fundador.' },
  { name: 'duarte', area: 'turismo' as AreaId, desc: 'Perfil humano: operações de frota e turismo. Dono da conta Google usada pelo Composio.' },
  { name: 'vianta', area: 'sistema' as AreaId, desc: 'Perfil humano: workspace da equipa.' },
];

/** Informação dos perfis-agente que o snapshot não traz. */
export const AGENT_INFO: Record<string, { area: AreaId; role: string; desc: string; facts?: Fact[] }> = {
  jarvis: { area: 'sistema', role: 'CEO · orquestrador', desc: 'Ponto de contacto único. Recebe pedidos do Telegram e do Desktop e delega nos agentes especialistas.', facts: [['Delegação', 'delegate_task() para os especialistas', true], ['Entrada', 'Telegram «Vianta Jarvis» e Desktop']] },
  'agente-comercial': { area: 'comercial', role: 'Bot comercial TVDE', desc: 'Responde a leads TVDE via GHL (Messenger, Instagram e WhatsApp).', facts: [['Governança', 'Resposta a leads é Tier 0 (automático)']] },
  'agente-turismo': { area: 'turismo', role: 'Bot Turismo · ChoiceCar', desc: 'Processa emails da ChoiceCar, sincroniza transfers e planeia a frota de turismo.', facts: [['Parceiro', 'ChoiceCar (maior volume do Turismo)']] },
  'media-buyer': { area: 'marketing', role: 'Gestor de anúncios Meta', desc: 'Perfil de ferramentas para análise e reports de Meta Ads.' },
  'agente-conteudo': { area: 'marketing', role: 'Criação de conteúdo', desc: 'Criativos, legendas, vídeos e thumbnails para marketing.' },
};

/** Área de cada skill (o snapshot só traz nome e descrição). */
export const SKILL_AREA: Record<string, AreaId> = {
  'vianta-resposta-interessados': 'comercial', 'vianta-simulacao-financeira': 'comercial', 'vianta-retoma': 'comercial',
  'vianta-choicecar-planeamento': 'turismo', 'vianta-choicecar-atualizacao': 'turismo', 'email-inbox-monitor': 'turismo',
  'vianta-media-buying': 'marketing', 'vianta-meta-queries': 'marketing', 'vianta-criacao-criativos': 'marketing',
  'vianta-descricao': 'marketing', 'vianta-legendas-instagram': 'marketing', 'vianta-thumbnail': 'marketing',
  'vianta-edicao-video': 'marketing', 'vianta-email-marketing': 'marketing',
  'vianta-orquestracao': 'sistema', 'vianta-aios-live': 'sistema', 'vianta-aios-vistoria': 'sistema',
  'vianta-auto-revisao': 'sistema', 'vianta-learning-db': 'sistema', 'vianta-assistente-voz': 'sistema',
  'vianta-base-dados': 'dados', 'vianta-supabase-queries': 'dados', 'vianta-composio': 'dados',
  'vianta-web-dev': 'web', 'vianta-operacoes': 'web', 'vianta-dns-workspace': 'web',
};

export const STATIC_NODES: RegNode[] = [
  { id: 'brain', label: 'vianta-brain', type: 'hub', area: 'sistema', desc: 'Conhecimento central do AI OS. Todos os perfis partem daqui.',
    facts: [['Caminho', '/opt/data/vianta-brain/', true], ['Runtime', 'Hermes Agent (Nous Research)'], ['Perfis', '/opt/data/profiles/<perfil>/', true]],
    links: [['Abrir pasta context/ no Drive', 'https://drive.google.com/drive/folders/15OXQaYMJtEKluTCXEe3b2VqQvJnap7ea']] },

  // Pastas
  { id: 'd:context', label: 'context/', type: 'folder', area: 'conhecimento', desc: 'Factos de negócio: fonte de verdade, cópias de Google Docs.', facts: [brain('context/')],
    links: [['Abrir pasta context/ no Drive', 'https://drive.google.com/drive/folders/15OXQaYMJtEKluTCXEe3b2VqQvJnap7ea']] },
  { id: 'd:intelligence', label: 'intelligence/', type: 'folder', area: 'conhecimento', desc: 'Aprendizagens extraídas de dados reais.', facts: [brain('intelligence/')] },
  { id: 'd:data', label: 'data/', type: 'folder', area: 'dados', desc: 'Registo das fontes de dados estruturados.', facts: [brain('data/')] },
  { id: 'd:sops', label: 'sops/', type: 'folder', area: 'conhecimento', desc: 'SOPs operacionais (Word e spec JSON).', facts: [brain('sops/')] },
  { id: 'd:operacoes-sops', label: 'operacoes-sops/', type: 'folder', area: 'conhecimento', desc: 'SOPs de operações (markdown).', facts: [brain('operacoes-sops/')] },
  { id: 'd:scripts', label: 'scripts/', type: 'folder', area: 'sistema', desc: 'Scripts das rotinas do jarvis.', facts: [['Caminho', '/opt/data/profiles/jarvis/scripts/', true]] },
  { id: 'd:skills', label: 'skills/vianta/', type: 'folder', area: 'sistema', desc: 'Onde estão instaladas as skills do ecossistema Vianta.', facts: [['Caminho', '/opt/data/profiles/jarvis/skills/vianta/', true]] },

  // Ficheiros do vianta-brain (IDs = cópias em Dos Inocentes LDA/context/ no Drive)
  { id: 'f:sobre-a-empresa', label: 'sobre-a-empresa.md', type: 'file', area: 'conhecimento', desc: 'Identidade legal, história, duas linhas de negócio, pessoas, estado atual.', facts: [brain('context/sobre-a-empresa.md'), ['Layer', 'Contexto']], links: [drive('1c1triqVfonjRRde_j0IdzlRSqYRDVKKd')] },
  { id: 'f:icp-tvde', label: 'icp-tvde.md', type: 'file', area: 'comercial', desc: 'ICP Segmento A/B e Dream Follower do TVDE.', facts: [brain('context/icp-tvde.md'), ['Layer', 'Contexto'], ['Fonte viva', 'AQUISIÇÃO/Marketing/Estratégia/ICP — Vianta.gdoc', true]], links: [drive('1G8STZyNNpYNsPRu5Jak27N_WPlEhow12')] },
  { id: 'f:posicionamento-tvde', label: 'posicionamento-tvde.md', type: 'file', area: 'comercial', desc: 'Frase de posicionamento e diferenciação face a 5 concorrentes.', facts: [brain('context/posicionamento-tvde.md'), ['Layer', 'Contexto'], ['Fonte viva', 'AQUISIÇÃO/Marketing/Estratégia/Positioning Template — Vianta.gdoc', true]], links: [drive('12Fig-aBu5rJYdPG8Mx-hWBNOHj66kMth')] },
  { id: 'f:oferta-tvde', label: 'oferta-tvde.md', type: 'file', area: 'comercial', desc: '3 ofertas TVDE (Aluguer, Slot, Venda): preços e regras.', facts: [brain('context/oferta-tvde.md'), ['Layer', 'Contexto'], ['Fonte viva', 'AQUISIÇÃO/Marketing/Estratégia/Offer Document — Vianta.gdoc', true]], links: [drive('1G9HoCRKIMiCMyuwZa_mC0dfQ6YKW0c-2')] },
  { id: 'f:mercado-e-concorrencia-tvde', label: 'mercado-e-concorrencia-tvde.md', type: 'file', area: 'marketing', desc: 'Panorama de conteúdo TVDE em PT, gaps, TAM/SAM/SOM.', facts: [brain('context/mercado-e-concorrencia-tvde.md'), ['Layer', 'Contexto']], links: [drive('1VEBZzNSQ_xDKrWiM9_QHlmOX_U0hWN_2')] },
  { id: 'f:regulacao-tvde-2026', label: 'regulacao-tvde-2026.md', type: 'file', area: 'conhecimento', desc: 'Resumo da Nova Lei TVDE 2026.', facts: [brain('context/regulacao-tvde-2026.md'), ['Layer', 'Contexto']], links: [drive('1KAbyjc2Fs1eEyGlT3GJpAE0nZDsrSX5D')] },
  { id: 'f:turismo-vianta-prestige', label: 'turismo-vianta-prestige.md', type: 'file', area: 'turismo', desc: 'Segmentos, proposta de valor e pricing do Turismo.', facts: [brain('context/turismo-vianta-prestige.md'), ['Layer', 'Contexto']], links: [drive('1xMytWZ1g45iHraptVaShK2GotelY9x4s')] },
  { id: 'f:tom-de-voz', label: 'tom-de-voz.md', type: 'file', area: 'marketing', desc: 'Tom neutro e realista para conteúdo com números.', facts: [brain('context/tom-de-voz.md'), ['Layer', 'Contexto']], links: [drive('1GaRvCbhJXACPOKIjlw7Ptx9IpXxiYafO')] },
  { id: 'f:assets-digitais-lovable', label: 'assets-digitais-lovable.md', type: 'file', area: 'web', desc: 'Landing pages e apps Lovable.', facts: [brain('context/assets-digitais-lovable.md'), ['Layer', 'Contexto']], links: [drive('15v0ZzP-A_2N133yt2TWgWUsuQkT-3eMq')] },
  { id: 'f:gerador-propostas-vendas-tvde', label: 'gerador-propostas-vendas-tvde.md', type: 'file', area: 'comercial', desc: 'Ferramenta de propostas de venda.', facts: [brain('context/gerador-propostas-vendas-tvde.md'), ['Layer', 'Contexto']], links: [drive('1bbmdd9q5FswoVFXf2mnXI41RyR3HhSC7')] },
  { id: 'f:app-transfers-tours-vianta', label: 'app-transfers-tours-vianta.md', type: 'file', area: 'turismo', desc: 'App de transfers e tours do Turismo.', facts: [brain('context/app-transfers-tours-vianta.md'), ['Layer', 'Contexto']], links: [drive('1QD_kUqGmv8eb4oYZ-LXSSm4SM-ay6Nzb')] },
  { id: 'f:memory', label: 'memory.md', type: 'file', area: 'sistema', desc: 'Decisões, exclusões de segurança, pontos por confirmar.', facts: [brain('context/memory.md'), ['Layer', 'Contexto']], links: [drive('1s4YaFTlTz9XLmIwMdFR4iEzvDr8dMPol')] },
  { id: 'f:estrategia-vianta', label: 'estrategia-vianta.md', type: 'file', area: 'conhecimento', desc: 'North Star, alocação de capital, mix de frota, margens, target 2027.', facts: [brain('context/estrategia-vianta.md'), ['Layer', 'Estratégia (vive em context/)'], ['No Drive', 'Sem cópia encontrada: só existe no Hermes']] },
  { id: 'f:oferta-investidor', label: 'oferta-investidor.md', type: 'file', area: 'conhecimento', desc: '4.ª oferta (investidor): split, perfil, condições.', facts: [brain('context/oferta-investidor.md'), ['Layer', 'Estratégia (vive em context/)'], ['No Drive', 'Sem cópia encontrada: só existe no Hermes']] },
  { id: 'f:funil-e-metricas-tvde', label: 'funil-e-metricas-tvde.md', type: 'file', area: 'comercial', desc: 'Etapas do funil no CRM, métricas, escada de dados.', facts: [brain('context/funil-e-metricas-tvde.md'), ['Layer', 'Estratégia (vive em context/)']], links: [drive('1brBvPE_U5JGpuIxKzNysL7Zw5KVG_3kS')] },
  { id: 'f:governanca-agentes', label: 'governanca-agentes.md', type: 'file', area: 'sistema', desc: 'Regras Tier 0 (automático) e Tier 1 (aprovação humana).', facts: [brain('context/governanca-agentes.md'), ['Layer', 'Estratégia (vive em context/)']], links: [drive('15HifUJIkq4-JAJqR5_hxgxVdJXMofHZw')] },
  { id: 'f:perfil-compra', label: 'perfil-compra.md', type: 'file', area: 'comercial', desc: 'Padrões dos fechos reais de venda. Uso interno.', facts: [brain('intelligence/perfil-compra.md'), ['Layer', 'Intelligence'], ['Confiança', 'Média (3 a 9 casos)'], ['No Drive', 'Equivalente: perfil-clientes-reais-tvde.md (por confirmar)']], links: [drive('1CttdhCbpQo_GjQ7yiEQAfKXmNiWx9PzV')] },
  { id: 'f:teste-criativo-mecanismo', label: 'teste-criativo-mecanismo.md', type: 'file', area: 'marketing', desc: 'Resultados do teste A/B/C (ago/2026), baseline, regra da capacidade.', facts: [brain('intelligence/teste-criativo-mecanismo.md'), ['Layer', 'Intelligence'], ['Confiança', 'Alta'], ['No Drive', 'Equivalente: teste-criativo-vs-mecanismo-2026-08.md (por confirmar)']], links: [drive('1TDOwinFvUbEd3xZIWpna-sR3gUotzVKr')] },
  { id: 'f:avaliacao-criativos', label: 'avaliacao-criativos.md', type: 'file', area: 'marketing', desc: 'Porque o CPL engana, a qualificação não matura, mínimos.', facts: [brain('intelligence/avaliacao-criativos.md'), ['Layer', 'Intelligence'], ['Confiança', 'Média'], ['No Drive', 'Sem cópia encontrada: só existe no Hermes']] },

  // Estado
  { id: 'x:aios-state.json', label: 'aios-state.json', type: 'script', area: 'sistema', desc: 'Snapshot do estado do AI OS, regenerado a cada 10 minutos. É o que alimenta esta página.', facts: [brain('aios-state.json'), ['Publicado em', '/aios-live/aios-state.json', true]] },

  // Tabelas
  { id: 't:vendas', label: 'vendas', type: 'data', area: 'comercial', desc: 'Contratos de venda, aluguer e slot.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]] },
  { id: 't:meta_spend_daily', label: 'meta_spend_daily', type: 'data', area: 'marketing', desc: 'Gasto Meta diário por campanha.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]] },
  { id: 't:campanha_oferta', label: 'campanha_oferta', type: 'data', area: 'marketing', desc: 'Classificação campanha → oferta.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]] },
  { id: 't:carros', label: 'carros', type: 'data', area: 'dados', desc: 'Stock de viaturas. Fonte única dos carros.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]], countKeys: ['carros'] },
  { id: 't:financeiro', label: 'financeiro', type: 'data', area: 'dados', desc: 'Movimentos financeiros por viatura.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]] },
  { id: 't:motoristas', label: 'motoristas · pagamentos', type: 'data', area: 'dados', desc: 'Motoristas e pagamentos semanais.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]] },
  { id: 't:transfers', label: 'transfers · partners · pricing', type: 'data', area: 'turismo', desc: 'Tabelas do Turismo: transfers, drivers, vehicles, partners e pricing.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]], countKeys: ['transfers'] },
  { id: 't:cc', label: 'cc_services · cc_offers', type: 'data', area: 'turismo', desc: 'Serviços e ofertas ChoiceCar.', facts: [['Projeto', 'Supabase principal']], links: [['Abrir no Supabase', `${SB}${SB_MAIN}/editor`]], countKeys: ['cc_services', 'cc_offers'] },
  { id: 't:raw_leads', label: 'raw_leads · source_mapping', type: 'data', area: 'comercial', desc: 'Leads com UTMs (projeto separado).', facts: [['Projeto', 'Supabase Aquisição']], links: [['Abrir no Supabase', `${SB}${SB_AQ}/editor`]] },

  // Integrações
  { id: 'i:ghl', label: 'GoHighLevel', type: 'integ', area: 'comercial', desc: 'CRM de leads e oportunidades (pipelines Aluguer e Venda).', healthKey: 'ghl', facts: [['Como', 'API REST'], ['Autenticação', 'Token']], links: [['Abrir GoHighLevel', 'https://app.gohighlevel.com/']] },
  { id: 'i:supabase', label: 'Supabase', type: 'integ', area: 'dados', desc: 'Base de dados: projeto principal e projeto Aquisição.', healthKey: 'supabase_vendas', countKeys: ['carros', 'transfers', 'cc_services', 'cc_offers'], facts: [['Como', 'REST API'], ['Autenticação', 'API key + Bearer']], links: [['Supabase · principal', `${SB}${SB_MAIN}`], ['Supabase · Aquisição', `${SB}${SB_AQ}`]] },
  { id: 'i:meta_ads', label: 'Meta Ads', type: 'integ', area: 'marketing', desc: 'Conta de anúncios Meta.', healthKey: 'meta_ads', facts: [['Como', 'API via Composio MCP'], ['Autenticação', 'OAuth (Composio)']], links: [['Abrir Meta Ads Manager', 'https://adsmanager.facebook.com/']] },
  { id: 'i:composio', label: 'Composio MCP', type: 'integ', area: 'dados', desc: 'Ponte MCP para Gmail, Sheets, Drive e Meta Ads.', healthKey: 'composio', facts: [['Como', 'MCP'], ['Autenticação', 'OAuth (Composio)'], ['Conta', 'Google do Duarte']], links: [['Abrir Composio', 'https://app.composio.dev/']] },
  { id: 'i:sheets', label: 'Google Sheets', type: 'integ', area: 'dados', desc: 'DB Transfers, Drivers Transfers, propostas, CONTROLO CHOICE CAR.', healthKey: 'sheets', facts: [['Como', 'Composio MCP']] },
  { id: 'i:gmail', label: 'Gmail', type: 'integ', area: 'dados', desc: 'geral@vianta.pt via Composio.', healthKey: 'gmail', facts: [['Como', 'Composio MCP']] },
  { id: 'i:drive', label: 'Google Drive', type: 'integ', area: 'dados', desc: 'Docs fonte autoritativa.', healthKey: 'drive', facts: [['Como', 'Composio MCP']], links: [['Abrir Google Drive', 'https://drive.google.com/']] },
  { id: 'i:choicecar', label: 'ChoiceCar', type: 'integ', area: 'turismo', desc: 'Parceiro de maior volume do Turismo: email → sheet → Supabase → App Transfers.', facts: [['Como', 'Email + Google Sheets'], ['Autenticação', 'Composio / token legado']] },
  { id: 'i:telegram', label: 'Telegram', type: 'integ', area: 'sistema', desc: 'Gateway Hermes «Vianta Jarvis».', facts: [['Como', 'Hermes Gateway'], ['Autenticação', 'Bot token']], links: [['Abrir Telegram', 'https://web.telegram.org/']] },
  { id: 'i:netlify', label: 'Netlify', type: 'integ', area: 'web', desc: 'Deploy das apps web (git push + auto-deploy).', healthKey: 'netlify', facts: [['Autenticação', 'Netlify token']], links: [['Abrir Netlify', 'https://app.netlify.com/']] },
  { id: 'i:frota360', label: 'Frota360', type: 'integ', area: 'dados', desc: 'Gestão de frota. Legado por scraping (Playwright), substituído por Supabase.', healthKey: 'frota360', facts: [['Como', 'Playwright (scraping)'], ['Autenticação', 'Credenciais']], links: [['Abrir Frota360', 'https://vianta.frota360.pt/admin']] },

  // Apps
  { id: 'a:central', label: 'Central Vianta', type: 'app', area: 'web', desc: 'ERP principal: Vendas, Operações, AI OS e Config.', facts: [['URL', 'vianta-dashboard.netlify.app', true], ['Stack', 'React + Vite + Supabase + Netlify']], links: [['Abrir Central Vianta', 'https://vianta-dashboard.netlify.app']] },
  { id: 'a:aios-live', label: 'AI OS Live', type: 'app', area: 'sistema', desc: 'Esta página: estado ao vivo do AI OS.', facts: [['URL', 'vianta-dashboard.netlify.app/aios', true]] },
  { id: 'a:transfers', label: 'App Transfers', type: 'app', area: 'turismo', desc: 'Marcação de transfers e tours para parceiros B2B e gestor.', facts: [['URL', 'vianta-transfers.netlify.app', true], ['Stack', 'React + Supabase + Netlify']], links: [['Abrir App Transfers', 'https://vianta-transfers.netlify.app']] },
  { id: 'a:propostas', label: 'Gerador de Propostas', type: 'app', area: 'comercial', desc: 'Gera propostas de venda TVDE em PDF.', facts: [['URL', 'propostas-vianta.netlify.app', true], ['Stack', 'HTML/JS']], links: [['Abrir Gerador de Propostas', 'https://propostas-vianta.netlify.app/']] },
  { id: 'a:lovable', label: 'Apps Lovable', type: 'app', area: 'web', desc: 'Landing pages de compra e aluguer.', facts: [['Plataforma', 'Lovable']], links: [['Abrir vianta-compra', 'https://vianta-compra.lovable.app'], ['Abrir vianta-aluguer', 'https://vianta-aluguer.lovable.app']] },
];

/** Ligações estáticas (ids de perfis = 'p:<nome>', skills = 's:<nome>'). */
export const STATIC_EDGES: [string, string][] = [
  ['brain', 'd:context'], ['brain', 'd:intelligence'], ['brain', 'd:data'], ['brain', 'd:sops'], ['brain', 'd:operacoes-sops'], ['brain', 'x:aios-state.json'],
  ['p:jarvis', 'brain'], ['p:jarvis', 'd:scripts'], ['p:jarvis', 'd:skills'],
  ['i:telegram', 'p:jarvis'], ['p:francisco', 'i:telegram'], ['p:duarte', 'i:telegram'], ['p:vianta', 'i:telegram'], ['p:duarte', 'i:composio'],
  ...['sobre-a-empresa', 'icp-tvde', 'posicionamento-tvde', 'oferta-tvde', 'mercado-e-concorrencia-tvde', 'regulacao-tvde-2026', 'turismo-vianta-prestige', 'tom-de-voz', 'assets-digitais-lovable', 'gerador-propostas-vendas-tvde', 'app-transfers-tours-vianta', 'memory', 'estrategia-vianta', 'oferta-investidor', 'funil-e-metricas-tvde', 'governanca-agentes']
    .map((f) => ['d:context', `f:${f}`] as [string, string]),
  ['d:intelligence', 'f:perfil-compra'], ['d:intelligence', 'f:teste-criativo-mecanismo'], ['d:intelligence', 'f:avaliacao-criativos'],
  ...['vendas', 'meta_spend_daily', 'campanha_oferta', 'carros', 'financeiro', 'motoristas', 'transfers', 'cc', 'raw_leads'].flatMap((t) => [['d:data', `t:${t}`], ['i:supabase', `t:${t}`]] as [string, string][]),
  ['p:agente-comercial', 'i:ghl'], ['p:agente-comercial', 'i:supabase'],
  ['p:agente-turismo', 'i:choicecar'], ['p:agente-turismo', 'i:sheets'], ['p:agente-turismo', 'i:gmail'], ['p:agente-turismo', 'i:supabase'],
  ['p:media-buyer', 'i:meta_ads'],
  ['a:central', 't:vendas'], ['a:central', 't:meta_spend_daily'], ['a:central', 't:carros'], ['a:central', 't:financeiro'], ['a:central', 't:motoristas'], ['a:central', 't:raw_leads'], ['a:central', 'i:ghl'], ['a:central', 'i:supabase'],
  ['a:aios-live', 'x:aios-state.json'], ['a:central', 'a:aios-live'],
  ['a:transfers', 't:transfers'], ['a:transfers', 'i:supabase'],
  ['i:netlify', 'a:central'], ['i:netlify', 'a:transfers'], ['i:netlify', 'a:propostas'],
  ['f:assets-digitais-lovable', 'a:lovable'], ['f:gerador-propostas-vendas-tvde', 'a:propostas'], ['f:app-transfers-tours-vianta', 'a:transfers'], ['a:lovable', 'i:ghl'],
  ['i:frota360', 'i:supabase'], ['i:choicecar', 'i:sheets'], ['i:ghl', 't:vendas'], ['i:drive', 'd:context'],
  ['i:composio', 'i:gmail'], ['i:composio', 'i:sheets'], ['i:composio', 'i:drive'], ['i:composio', 'i:meta_ads'],
];

/** Skill → sistema que usa (deduzido da descrição de cada skill). */
export const SKILL_EDGES: [string, string][] = [
  ['vianta-base-dados', 'i:supabase'], ['vianta-base-dados', 't:carros'], ['vianta-base-dados', 't:motoristas'],
  ['vianta-supabase-queries', 'i:supabase'], ['vianta-supabase-queries', 't:carros'], ['vianta-supabase-queries', 't:transfers'],
  ['vianta-composio', 'i:composio'], ['vianta-media-buying', 'i:meta_ads'], ['vianta-meta-queries', 'i:meta_ads'], ['vianta-meta-queries', 'i:sheets'],
  ['vianta-choicecar-planeamento', 'i:choicecar'], ['vianta-choicecar-planeamento', 'i:sheets'], ['vianta-choicecar-planeamento', 't:transfers'],
  ['vianta-choicecar-atualizacao', 'i:choicecar'], ['email-inbox-monitor', 'i:gmail'], ['vianta-email-marketing', 'i:gmail'],
  ['vianta-web-dev', 'i:netlify'], ['vianta-web-dev', 'a:central'], ['vianta-web-dev', 'a:transfers'],
  ['vianta-aios-live', 'x:aios-state.json'], ['vianta-aios-live', 'a:aios-live'], ['vianta-learning-db', 'd:intelligence'],
  ['vianta-operacoes', 'a:central'], ['vianta-dns-workspace', 'i:gmail'], ['vianta-orquestracao', 'p:jarvis'],
];

/** Rotina → sistemas, pelo nome da rotina (fluxos do briefing). */
export const CRON_RULES: { re: RegExp; to: string[] }[] = [
  { re: /meta.*spend/i, to: ['i:meta_ads', 't:meta_spend_daily'] },
  { re: /snapshot/i, to: ['x:aios-state.json'] },
  { re: /auditoria/i, to: ['i:ghl', 'i:telegram', 'p:agente-comercial'] },
  { re: /ghl daily/i, to: ['i:ghl', 'i:telegram'] },
  { re: /resposta direta|follow-up/i, to: ['i:ghl'] },
  { re: /choicecar/i, to: ['i:choicecar'] },
  { re: /sync check/i, to: ['t:transfers'] },
  { re: /stock venda/i, to: ['t:carros', 'i:gmail'] },
  { re: /newsletter/i, to: ['i:gmail'] },
];
