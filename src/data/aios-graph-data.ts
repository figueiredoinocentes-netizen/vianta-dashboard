/// <reference types="vite/client" />

/**
 * JaNIS Graph — dados do grafo do AI OS.
 * Define todos os nós (agentes, integrações, skills, dados) e arestas (conexões)
 * para a visualização interativa no Central Vianta.
 */

export interface GraphNode {
  id: string;
  label: string;
  type: 'agent' | 'integration' | 'data' | 'skill' | 'cron' | 'app' | 'knowledge' | 'channel';
  group: string;
  status?: 'ok' | 'err' | 'warn' | 'off';
  description?: string;
  meta?: string;
  // Layout hints (opcional — o force layout calcula automaticamente)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  color?: string;
  dashed?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Dados estáticos do grafo JaNIS.
 * Os status são atualizados dinamicamente pelo aios_snapshot.py.
 */
export const AIOS_GRAPH: GraphData = {
  nodes: [
    // ── Canais de entrada ──
    { id: 'channel-telegram', label: 'Telegram', type: 'channel', group: 'channels', description: 'Vianta Jarvis Bot' },
    { id: 'channel-desktop', label: 'Desktop', type: 'channel', group: 'channels', description: 'Hermes App' },
    { id: 'channel-messenger', label: 'Messenger', type: 'channel', group: 'channels', description: 'Facebook / IG DM via GHL' },
    { id: 'channel-email', label: 'Email', type: 'channel', group: 'channels', description: 'geral@vianta.pt / ChoiceCar' },

    // ── Agentes ──
    { id: 'jarvis', label: 'Jarvis', type: 'agent', group: 'agents', description: 'CEO / Orquestrador', status: 'ok' },
    { id: 'agente-comercial', label: 'Agente Comercial', type: 'agent', group: 'agents', description: 'Leads TVDE · GHL', status: 'ok' },
    { id: 'agente-turismo', label: 'Agente Turismo', type: 'agent', group: 'agents', description: 'ChoiceCar · Transfers', status: 'ok' },
    { id: 'media-buyer', label: 'Media Buyer', type: 'agent', group: 'agents', description: 'Meta Ads · Análise', status: 'ok' },
    { id: 'agente-conteudo', label: 'Agente Conteúdo', type: 'agent', group: 'agents', description: 'Criativos · Legendas', status: 'ok' },

    // ── Integrações ──
    { id: 'ghl', label: 'GHL CRM', type: 'integration', group: 'integrations', description: 'Conversas · Oportunidades · Pipelines' },
    { id: 'supabase', label: 'Supabase', type: 'integration', group: 'integrations', description: 'Fonte de verdade · Stock · Vendas · Transfers' },
    { id: 'meta-ads', label: 'Meta Ads', type: 'integration', group: 'integrations', description: 'act_293842623 · Anúncios · Spend' },
    { id: 'google', label: 'Google Workspace', type: 'integration', group: 'integrations', description: 'Gmail · Sheets · Drive via Composio' },
    { id: 'composio', label: 'Composio MCP', type: 'integration', group: 'integrations', description: '500+ apps · Bridge Google · Meta' },
    { id: 'netlify', label: 'Netlify', type: 'integration', group: 'integrations', description: 'Deploy · Functions · Apps' },
    { id: 'choicecar', label: 'ChoiceCar', type: 'integration', group: 'integrations', description: 'Parceiro Turismo · Email · Sheets' },

    // ── Dados (Supabase tables) ──
    { id: 'data-vendas', label: 'Vendas', type: 'data', group: 'data', description: 'Contratos compra/aluguer/slot' },
    { id: 'data-carros', label: 'Carros', type: 'data', group: 'data', description: 'Stock de viaturas' },
    { id: 'data-meta-spend', label: 'Meta Spend', type: 'data', group: 'data', description: 'Gasto diário por campanha' },
    { id: 'data-transfers', label: 'Transfers', type: 'data', group: 'data', description: 'Serviços Turismo' },
    { id: 'data-motoristas', label: 'Motoristas', type: 'data', group: 'data', description: 'Frota · Pagamentos' },
    { id: 'data-financeiro', label: 'Financeiro', type: 'data', group: 'data', description: 'Movimentos por viatura' },
    { id: 'data-raw-leads', label: 'Raw Leads', type: 'data', group: 'data', description: 'Leads com UTMs (projeto Aquisição)' },

    // ── Camadas de Conhecimento ──
    { id: 'knowledge-context', label: 'Context', type: 'knowledge', group: 'knowledge', description: 'Factos de negócio · Ofertas · Pricing' },
    { id: 'knowledge-data', label: 'Data', type: 'knowledge', group: 'knowledge', description: 'Bases de dados · Fontes estruturadas' },
    { id: 'knowledge-intelligence', label: 'Intelligence', type: 'knowledge', group: 'knowledge', description: 'Aprendizagens · Padrões · Insights' },

    // ── Apps ──
    { id: 'app-central', label: 'Central Vianta', type: 'app', group: 'apps', description: 'ERP · React SPA · Netlify' },
    { id: 'app-transfers', label: 'App Transfers', type: 'app', group: 'apps', description: 'Booking B2B Turismo' },
    { id: 'app-propostas', label: 'Gerador Propostas', type: 'app', group: 'apps', description: 'Propostas de venda TVDE' },
    { id: 'app-aios-live', label: 'AI OS Live', type: 'app', group: 'apps', description: 'Dashboard standalone do AI OS' },
  ],

  edges: [
    // ── Canais → Jarvis ──
    { source: 'channel-telegram', target: 'jarvis', label: 'gateway', color: '#22d3ee' },
    { source: 'channel-desktop', target: 'jarvis', label: 'UI' },
    { source: 'channel-messenger', target: 'agente-comercial', label: 'leads', color: '#a78bfa' },
    { source: 'channel-email', target: 'agente-turismo', label: 'ChoiceCar', color: '#fbbf24' },

    // ── Jarvis → Agentes (delegação) ──
    { source: 'jarvis', target: 'agente-comercial', label: 'delegate_task', color: '#22d3ee', dashed: true },
    { source: 'jarvis', target: 'agente-turismo', label: 'delegate_task', color: '#22d3ee', dashed: true },
    { source: 'jarvis', target: 'media-buyer', label: 'delegate_task', color: '#22d3ee', dashed: true },
    { source: 'jarvis', target: 'agente-conteudo', label: 'delegate_task', color: '#22d3ee', dashed: true },

    // ── Agentes → Integrações ──
    { source: 'agente-comercial', target: 'ghl', label: 'lê/escreve', color: '#a78bfa' },
    { source: 'agente-comercial', target: 'supabase', label: 'consulta stock', color: '#34d399' },
    { source: 'agente-turismo', target: 'choicecar', label: 'processa', color: '#fbbf24' },
    { source: 'agente-turismo', target: 'google', label: 'sheets', color: '#fbbf24' },
    { source: 'agente-turismo', target: 'supabase', label: 'escreve', color: '#34d399' },
    { source: 'media-buyer', target: 'meta-ads', label: 'analisa', color: '#f472b6' },
    { source: 'media-buyer', target: 'google', label: 'reports', color: '#f472b6' },

    // ── Integrações entre si ──
    { source: 'composio', target: 'google', label: 'bridge', color: '#818cf8', dashed: true },
    { source: 'composio', target: 'meta-ads', label: 'bridge', color: '#818cf8', dashed: true },
    { source: 'ghl', target: 'supabase', label: 'backfill', color: '#94a3b8', dashed: true },

    // ── Supabase → Dados ──
    { source: 'supabase', target: 'data-vendas', label: 'tabela', color: '#34d399' },
    { source: 'supabase', target: 'data-carros', label: 'tabela', color: '#34d399' },
    { source: 'supabase', target: 'data-meta-spend', label: 'tabela', color: '#34d399' },
    { source: 'supabase', target: 'data-transfers', label: 'tabela', color: '#34d399' },
    { source: 'supabase', target: 'data-motoristas', label: 'tabela', color: '#34d399' },
    { source: 'supabase', target: 'data-financeiro', label: 'tabela', color: '#34d399' },
    { source: 'supabase', target: 'data-raw-leads', label: 'tabela', color: '#34d399' },

    // ── Dados → Conhecimento ──
    { source: 'data-vendas', target: 'knowledge-intelligence', label: 'alimenta', color: '#a78bfa', dashed: true },
    { source: 'data-carros', target: 'knowledge-data', label: 'fonte', color: '#a78bfa', dashed: true },
    { source: 'data-meta-spend', target: 'knowledge-intelligence', label: 'alimenta', color: '#a78bfa', dashed: true },
    { source: 'data-transfers', target: 'knowledge-data', label: 'fonte', color: '#a78bfa', dashed: true },

    // ── Conhecimento entre si ──
    { source: 'knowledge-context', target: 'knowledge-data', label: 'contexto', color: '#64748b', dashed: true },
    { source: 'knowledge-data', target: 'knowledge-intelligence', label: 'processa', color: '#64748b', dashed: true },

    // ── Agentes → Conhecimento ──
    { source: 'agente-comercial', target: 'knowledge-context', label: 'consulta', color: '#a78bfa', dashed: true },
    { source: 'agente-comercial', target: 'knowledge-intelligence', label: 'gera', color: '#a78bfa', dashed: true },
    { source: 'agente-turismo', target: 'knowledge-context', label: 'consulta', color: '#fbbf24', dashed: true },

    // ── Apps → Integrações ──
    { source: 'app-central', target: 'supabase', label: 'lê', color: '#34d399' },
    { source: 'app-central', target: 'netlify', label: 'deploy', color: '#38bdf8' },
    { source: 'app-central', target: 'ghl', label: 'dados funil', color: '#a78bfa', dashed: true },
    { source: 'app-transfers', target: 'supabase', label: 'lê/escreve', color: '#34d399' },
    { source: 'app-transfers', target: 'netlify', label: 'deploy', color: '#38bdf8' },
    { source: 'app-propostas', target: 'netlify', label: 'deploy', color: '#38bdf8' },
    { source: 'app-aios-live', target: 'netlify', label: 'deploy', color: '#38bdf8' },
  ],
};

/** Cores por tipo de nó */
export const NODE_COLORS: Record<string, string> = {
  agent: '#22d3ee',       // cyan
  channel: '#64748b',     // slate
  integration: '#a78bfa', // violet
  data: '#34d399',        // emerald
  knowledge: '#fbbf24',   // amber
  app: '#38bdf8',         // sky
  skill: '#f472b6',       // pink
  cron: '#fb923c',        // orange
};

/** Ícones por tipo (usar emoji para simplificar — depois trocar por Lucide) */
export const NODE_ICONS: Record<string, string> = {
  agent: '🤖',
  channel: '📡',
  integration: '🔗',
  data: '🗄️',
  knowledge: '🧠',
  app: '🖥️',
  skill: '⚡',
  cron: '⏰',
};

/** Tamanhos por tipo */
export const NODE_SIZES: Record<string, number> = {
  agent: 28,
  channel: 20,
  integration: 24,
  data: 22,
  knowledge: 32,
  app: 26,
  skill: 18,
  cron: 16,
};
