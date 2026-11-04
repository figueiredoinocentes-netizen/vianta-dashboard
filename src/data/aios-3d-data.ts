/**
 * JaNIS 3D — Dados do grafo para a Órbita 3D
 * Baseado no protótipo centro-comando.dc.html
 */

// Paleta de áreas
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

// Tipos de nó
export type NodeType = 'hub' | 'agent' | 'human' | 'folder' | 'file' | 'script' | 'data' | 'skill' | 'cron' | 'integ' | 'app';

export const TYPE_NAME: Record<NodeType, string> = {
  hub: 'núcleo', agent: 'agente', human: 'humano', folder: 'pasta', file: 'ficheiro',
  script: 'script', data: 'dados', skill: 'skill', cron: 'rotina', integ: 'integração', app: 'app'
};
export const TYPE_GROUP: Record<NodeType, string> = {
  hub: 'core', agent: 'agent', human: 'agent', folder: 'file', file: 'file',
  script: 'file', data: 'data', skill: 'skill', cron: 'cron', integ: 'integ', app: 'app'
};
export const SIZE: Record<NodeType, number> = {
  hub: 30, agent: 20, human: 11, folder: 11, file: 6, script: 8, data: 8, skill: 10, cron: 10, integ: 11, app: 14
};

export interface AiosNode {
  id: string;
  label: string;
  type: NodeType;
  area: AreaId;
  desc: string;
  // 3D/2D layout
  p3?: [number, number, number];
  p2?: [number, number];
  // Runtime
  cron?: any[];
  sched?: string;
}

export interface AiosEdge {
  source: string;
  target: string;
}

export interface AiosCron {
  id: string;
  label: string;
  area: AreaId;
  owner: string;
  intervalMin?: number;
  time?: string;
  weekday?: number;
  paused: boolean;
  skills: string[];
}

// Nós — todos os assets do AI OS
export const NODES_DATA: AiosNode[] = [
  { id: 'brain', label: 'vianta-brain', type: 'hub', area: 'sistema', desc: 'Conhecimento central em /opt/data/vianta-brain/.' },
  { id: 'jarvis', label: 'jarvis', type: 'agent', area: 'sistema', desc: 'CEO e orquestrador.' },
  { id: 'ag-com', label: 'agente-comercial', type: 'agent', area: 'comercial', desc: 'Bot comercial TVDE.' },
  { id: 'ag-tur', label: 'agente-turismo', type: 'agent', area: 'turismo', desc: 'Bot Turismo / ChoiceCar.' },
  { id: 'ag-med', label: 'media-buyer', type: 'agent', area: 'marketing', desc: 'Gestor de anúncios Meta.' },
  { id: 'ag-con', label: 'agente-conteudo', type: 'agent', area: 'marketing', desc: 'Criação de conteúdo.' },
  { id: 'h-fra', label: 'francisco', type: 'human', area: 'sistema', desc: 'Perfil humano: fundador.' },
  { id: 'h-dua', label: 'duarte', type: 'human', area: 'turismo', desc: 'Perfil humano: operações.' },
  { id: 'h-via', label: 'vianta', type: 'human', area: 'sistema', desc: 'Perfil humano: equipa.' },
  { id: 'd-ctx', label: 'context/', type: 'folder', area: 'conhecimento', desc: 'Factos de negócio.' },
  { id: 'd-int', label: 'intelligence/', type: 'folder', area: 'conhecimento', desc: 'Aprendizagens.' },
  { id: 'd-dat', label: 'data/', type: 'folder', area: 'dados', desc: 'Fontes de dados.' },
  { id: 'd-sop', label: 'sops/', type: 'folder', area: 'conhecimento', desc: 'SOPs operacionais.' },
  { id: 'd-osp', label: 'operacoes-sops/', type: 'folder', area: 'conhecimento', desc: 'SOPs operações.' },
  { id: 'd-scr', label: 'scripts/', type: 'folder', area: 'sistema', desc: 'Scripts utilitários.' },
  // Files (f1-19)
  { id: 'f1', label: 'sobre-a-empresa.md', type: 'file', area: 'conhecimento', desc: 'Identidade legal.' },
  { id: 'f2', label: 'icp-tvde.md', type: 'file', area: 'comercial', desc: 'ICP TVDE.' },
  { id: 'f3', label: 'posicionamento-tvde.md', type: 'file', area: 'comercial', desc: 'Posicionamento.' },
  { id: 'f4', label: 'oferta-tvde.md', type: 'file', area: 'comercial', desc: 'Ofertas TVDE.' },
  { id: 'f5', label: 'mercado-e-concorrencia-tvde.md', type: 'file', area: 'marketing', desc: 'Concorrência.' },
  { id: 'f6', label: 'regulacao-tvde-2026.md', type: 'file', area: 'conhecimento', desc: 'Regulação.' },
  { id: 'f7', label: 'turismo-vianta-prestige.md', type: 'file', area: 'turismo', desc: 'Turismo.' },
  { id: 'f8', label: 'tom-de-voz.md', type: 'file', area: 'marketing', desc: 'Tom de voz.' },
  { id: 'f9', label: 'assets-digitais-lovable.md', type: 'file', area: 'web', desc: 'Apps Lovable.' },
  { id: 'f10', label: 'gerador-propostas-vendas-tvde.md', type: 'file', area: 'comercial', desc: 'Propostas.' },
  { id: 'f11', label: 'app-transfers-tours-vianta.md', type: 'file', area: 'turismo', desc: 'App Transfers.' },
  { id: 'f12', label: 'memory.md', type: 'file', area: 'sistema', desc: 'Decisões.' },
  { id: 'f13', label: 'estrategia-vianta.md', type: 'file', area: 'conhecimento', desc: 'Estratégia.' },
  { id: 'f14', label: 'oferta-investidor.md', type: 'file', area: 'conhecimento', desc: 'Oferta investidor.' },
  { id: 'f15', label: 'funil-e-metricas-tvde.md', type: 'file', area: 'comercial', desc: 'Funil.' },
  { id: 'f16', label: 'governanca-agentes.md', type: 'file', area: 'sistema', desc: 'Governança.' },
  { id: 'f17', label: 'perfil-compra.md', type: 'file', area: 'comercial', desc: 'Perfil compra.' },
  { id: 'f18', label: 'teste-criativo-mecanismo.md', type: 'file', area: 'marketing', desc: 'Teste criativo.' },
  { id: 'f19', label: 'avaliacao-criativos.md', type: 'file', area: 'marketing', desc: 'Avaliação.' },
  // Scripts
  { id: 'x1', label: 'aios_snapshot.py', type: 'script', area: 'sistema', desc: 'Gera o aios-state.json.' },
  { id: 'x2', label: 'daily_audit_report.py', type: 'script', area: 'comercial', desc: 'Auditoria diária.' },
  { id: 'x3', label: 'aios-state.json', type: 'script', area: 'sistema', desc: 'Snapshot do AI OS.' },
  // Tabelas
  { id: 't1', label: 'vendas', type: 'data', area: 'comercial', desc: 'Contratos.' },
  { id: 't2', label: 'meta_spend_daily', type: 'data', area: 'marketing', desc: 'Gasto Meta.' },
  { id: 't3', label: 'campanha_oferta', type: 'data', area: 'marketing', desc: 'Classificação.' },
  { id: 't4', label: 'carros', type: 'data', area: 'dados', desc: 'Stock.' },
  { id: 't5', label: 'financeiro', type: 'data', area: 'dados', desc: 'Movimentos.' },
  { id: 't6', label: 'motoristas · pagamentos', type: 'data', area: 'dados', desc: 'Motoristas.' },
  { id: 't7', label: 'transfers · partners · pricing', type: 'data', area: 'turismo', desc: 'Turismo.' },
  { id: 't8', label: 'raw_leads · source_mapping', type: 'data', area: 'comercial', desc: 'Leads UTMs.' },
  // Skills (s1-25)
  ...Array.from({ length: 25 }, (_, i) => ({
    id: `s${i + 1}`,
    label: `vianta-skill-${i + 1}`,
    type: 'skill' as NodeType,
    area: (['comercial', 'marketing', 'turismo', 'sistema', 'dados', 'web'] as AreaId[])[i % 6],
    desc: 'Skill do AI OS.',
  })),
  // Integrações
  { id: 'i1', label: 'GoHighLevel', type: 'integ', area: 'comercial', desc: 'CRM.' },
  { id: 'i2', label: 'Supabase', type: 'integ', area: 'dados', desc: 'Base de dados.' },
  { id: 'i3', label: 'Meta Ads', type: 'integ', area: 'marketing', desc: 'Anúncios.' },
  { id: 'i4', label: 'Google · Composio', type: 'integ', area: 'dados', desc: 'Workspace.' },
  { id: 'i5', label: 'ChoiceCar', type: 'integ', area: 'turismo', desc: 'Parceiro.' },
  { id: 'i6', label: 'Telegram', type: 'integ', area: 'sistema', desc: 'Gateway.' },
  { id: 'i7', label: 'Netlify', type: 'integ', area: 'web', desc: 'Deploy.' },
  { id: 'i8', label: 'Frota360', type: 'integ', area: 'dados', desc: 'Legado.' },
  { id: 'i9', label: 'Google tokens legados', type: 'integ', area: 'dados', desc: 'Morto.' },
  // Apps
  { id: 'p1', label: 'Central Vianta', type: 'app', area: 'web', desc: 'ERP.' },
  { id: 'p2', label: 'App Transfers', type: 'app', area: 'turismo', desc: 'Booking.' },
  { id: 'p3', label: 'Gerador de Propostas', type: 'app', area: 'comercial', desc: 'Propostas.' },
  { id: 'p4', label: 'Apps Lovable', type: 'app', area: 'web', desc: 'LP.' },
];

// Arestas
export const EDGES_DATA: AiosEdge[] = [
  ['brain', 'd-ctx'], ['brain', 'd-int'], ['brain', 'd-dat'], ['brain', 'd-sop'], ['brain', 'd-osp'], ['brain', 'd-scr'], ['brain', 'x3'],
  ['jarvis', 'brain'], ['jarvis', 'ag-com'], ['jarvis', 'ag-tur'], ['jarvis', 'ag-med'], ['jarvis', 'ag-con'],
  ['i6', 'jarvis'], ['h-fra', 'i6'], ['h-dua', 'i6'], ['h-via', 'i6'], ['h-dua', 'i4'],
  ['ag-com', 'i1'], ['ag-tur', 'i5'], ['ag-tur', 'i4'], ['ag-tur', 'i2'], ['ag-med', 'i3'],
  ['p1', 't1'], ['p1', 't4'], ['p1', 't6'], ['p1', 't8'], ['p1', 'x3'], ['p1', 'i1'],
  ['i7', 'p1'], ['i7', 'p2'], ['i7', 'p3'],
].map(e => ({ source: e[0], target: e[1] }));

// Crons
export const CRONS_DATA: AiosCron[] = [
  { id: 'c1', label: 'Resposta direta a leads', area: 'comercial', owner: 'ag-com', intervalMin: 1, paused: false, skills: ['s1'] },
  { id: 'c2', label: 'Follow-up WhatsApp', area: 'comercial', owner: 'ag-com', time: '10:00', paused: false, skills: ['s1', 's20'] },
  { id: 'c3', label: 'GHL daily report', area: 'comercial', owner: 'jarvis', time: '10:00', paused: false, skills: [] },
  { id: 'c4', label: 'Auditoria Agente Comercial', area: 'comercial', owner: 'jarvis', time: '10:00', paused: false, skills: [] },
  { id: 'c5', label: 'Vistoria AI OS', area: 'sistema', owner: 'jarvis', time: '08:00', paused: false, skills: ['s17'] },
  { id: 'c6', label: '[Meta] Spend diário', area: 'marketing', owner: 'jarvis', time: '07:30', paused: false, skills: [] },
  { id: 'c7', label: '[AI OS] Snapshot live', area: 'sistema', owner: 'jarvis', intervalMin: 10, paused: false, skills: [] },
  { id: 'c8', label: 'Monitor Stock Venda', area: 'comercial', owner: 'jarvis', time: '11:00', weekday: 1, paused: false, skills: ['s14'] },
  { id: 'c9', label: 'ChoiceCar escala fechada', area: 'turismo', owner: 'jarvis', intervalMin: 30, paused: false, skills: [] },
  { id: 'c10', label: 'ChoiceCar auto-planeamento', area: 'turismo', owner: 'ag-tur', intervalMin: 15, paused: false, skills: ['s4', 's5'] },
  { id: 'c11', label: 'ChoiceCar sync check', area: 'turismo', owner: 'ag-tur', intervalMin: 30, paused: true, skills: [] },
  { id: 'c12', label: 'Newsletter replies handler', area: 'marketing', owner: 'jarvis', intervalMin: 30, paused: true, skills: [] },
  { id: 'c13', label: 'ChoiceCar driver-composio', area: 'turismo', owner: 'jarvis', intervalMin: 120, paused: true, skills: [] },
];

// Build ALL (with crons)
export const ALL_NODES: AiosNode[] = [...NODES_DATA];
CRONS_DATA.forEach(c => {
  const sched = c.intervalMin
    ? (c.intervalMin === 1 ? 'a cada 1 min' : c.intervalMin < 60 ? `a cada ${c.intervalMin} min` : `a cada ${c.intervalMin / 60}h`)
    : (c.weekday != null ? `segundas às ${c.time}` : `diário às ${c.time}`);
  ALL_NODES.push({
    id: c.id,
    label: c.label,
    type: 'cron',
    area: c.area,
    desc: `Rotina de ${c.owner} · ${sched}${c.paused ? ' · pausada' : ' · último estado: ok'}`,
    cron: [c],
    sched,
  });
});

// Build adjacency
export const BYID: Record<string, AiosNode> = {};
ALL_NODES.forEach(n => { BYID[n.id] = n; });
export const ADJ: Record<string, string[]> = {};
ALL_NODES.forEach(n => { ADJ[n.id] = []; });
EDGES_DATA.forEach(e => {
  if (ADJ[e.source] && ADJ[e.target]) {
    ADJ[e.source].push(e.target);
    ADJ[e.target].push(e.source);
  }
});