/**
 * Constrói o grafo da Órbita 3D a partir do snapshot ao vivo (aios-state.json)
 * + o registo estático (src/data/aios-orbit-registry.ts).
 *
 * Ao vivo: perfis, gateways, rotinas (estado, última/próxima execução, erros),
 * skills, health das integrações e contagens do Supabase.
 * Estático: documentos, pastas, tabelas, apps, links e ligações não deduzíveis.
 */
import {
  AREAS, AIDX, AGENT_INFO, HUMANS, SKILL_AREA, STATIC_NODES, STATIC_EDGES, SKILL_EDGES, CRON_RULES,
  type AreaId, type NodeType, type Fact, type Link,
} from '@/data/aios-orbit-registry';

export interface SnapCron {
  id?: string; name?: string; owner?: string; schedule?: string; state?: string; enabled?: boolean;
  last_run_at?: string | null; last_status?: string | null; last_error?: string | null;
  script?: string | null; monitor_script?: string | null; no_agent?: boolean; skills?: string[];
  next_run_at?: string | null; paused_at?: string | null; failure_streak?: number;
}
export interface SnapState {
  generated_at?: string;
  profiles?: { name?: string; role?: string; desc?: string; gateway?: { up?: boolean; pid?: string | number | null } | null; crons?: SnapCron[] }[];
  gateways?: Record<string, { up?: boolean; pid?: string | number | null }>;
  skills?: { name?: string; description?: string }[];
  mcp?: { name?: string; url?: string }[];
  supabase?: Record<string, number | null>;
  ghl?: { ok?: boolean | null; status?: number } | null;
  integrations?: Record<string, { ok?: boolean | null; note?: string }>;
  alerts?: string[];
}

export type Status = 'ok' | 'warn' | 'err' | 'off';

export interface CronInfo {
  id: string; nodeId: string; name: string; owner: string; scheduler: string; area: AreaId;
  schedule: string; timeLabel: string; intervalMin: number | null; dailyMin: number | null; weekday: number | null;
  runsToday: boolean; paused: boolean; stale: boolean; error: boolean;
  lastRun: Date | null; nextRun: Date | null; lastError: string; script: string | null;
  skills: string[]; failureStreak: number; pausedAt: Date | null;
}

export interface OrbitNode {
  id: string; label: string; type: NodeType; area: AreaId; desc: string;
  facts: Fact[]; links: Link[]; status?: Status;
  p3: [number, number, number]; p2: [number, number];
}

export interface Alert { level: 'alta' | 'media' | 'info'; title: string; text: string; tag: string; nodeId: string | null }

export interface ProfileInfo { id: string; name: string; role: string; area: AreaId; human: boolean; st: string; status: Status }

export interface OrbitGraph {
  nodes: OrbitNode[]; edges: [string, string][];
  byId: Record<string, OrbitNode>; adj: Record<string, string[]>;
  crons: CronInfo[]; profiles: ProfileInfo[]; alerts: Alert[];
  generatedAt: Date | null; areaCount: Record<string, number>;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WD_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n: number) => (n < 10 ? '0' : '') + n;
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDate = (s?: string | null) => (s ? new Date(s) : null);

export function ago(d: Date | null, now = Date.now()): string {
  if (!d) return '—';
  const s = (now - d.getTime()) / 1000;
  if (s < 0) return 'agora';
  if (s < 60) return `há ${Math.floor(s)}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} dias`;
}
export function until(d: Date | null, now = Date.now()): string {
  if (!d) return '—';
  const m = (d.getTime() - now) / 60000;
  if (m < 0) return 'em atraso';
  if (m < 1) return `em ${Math.max(0, Math.round(m * 60))}s`;
  if (m < 60) return `em ${Math.ceil(m)} min`;
  if (m < 1440) return `em ${Math.floor(m / 60)}h${pad(Math.round(m % 60))}`;
  return `em ${Math.floor(m / 1440)} dias`;
}
const dateTime = (d: Date | null) => (d ? `${d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} ${hhmm(d)}` : '—');

function parseSchedule(s = '') {
  const t = s.toLowerCase();
  let m = /every\s+(\d+)\s*m\b/.exec(t);
  if (m) return { intervalMin: Number(m[1]), dailyMin: null, weekday: null };
  m = /every\s+(\d+)\s*h\b/.exec(t);
  if (m) return { intervalMin: Number(m[1]) * 60, dailyMin: null, weekday: null };
  m = /every\s+(day|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm)?/.exec(t);
  if (m) {
    let h = Number(m[2]);
    if (m[4] === 'pm' && h < 12) h += 12;
    if (m[4] === 'am' && h === 12) h = 0;
    return { intervalMin: null, dailyMin: h * 60 + Number(m[3]), weekday: m[1] === 'day' ? null : WEEKDAYS.indexOf(m[1]) };
  }
  return { intervalMin: null, dailyMin: null, weekday: null };
}

function cronOwner(c: SnapCron): string {
  const m = /\[bot:([^\]]+)\]/.exec(c.name || '');
  if (m) return m[1];
  if (/^agente comercial/i.test(c.name || '')) return 'agente-comercial';
  return c.owner || 'jarvis';
}
function cronArea(owner: string, name: string): AreaId {
  if (AGENT_INFO[owner] && owner !== 'jarvis') return AGENT_INFO[owner].area;
  if (/choicecar|transfer/i.test(name)) return 'turismo';
  if (/meta|newsletter/i.test(name)) return 'marketing';
  if (/ghl|auditoria|stock|comercial|lead/i.test(name)) return 'comercial';
  return 'sistema';
}

function hash(s: string, k: number) {
  let h = 2166136261 ^ k;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

const ACENTER = AREAS.map((_, i) => {
  const y = 1 - ((i + 0.5) / AREAS.length) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996 + 0.6;
  return [Math.cos(th) * r * 250, y * 165, Math.sin(th) * r * 250];
});
const RF: Record<string, number> = { agent: 0.42, human: 0.7, folder: 1.05, file: 1.22, script: 1.0, data: 1.1, skill: 1.0, cron: 0.82, integ: 0.92, app: 0.78 };
const RING: Record<string, number> = { hub: 0, agent: 95, human: 95, cron: 175, integ: 175, app: 175, skill: 255, folder: 330, file: 330, script: 330, data: 330 };
export const RADII = [95, 175, 255, 330];
export const areaCenter3 = (i: number) => ACENTER[i];

export function buildOrbitGraph(state: SnapState | null, nowMs = Date.now()): OrbitGraph {
  const st = state || {};
  const nodes: OrbitNode[] = [];
  const byId: Record<string, OrbitNode> = {};
  const add = (n: Omit<OrbitNode, 'p3' | 'p2'>) => { if (byId[n.id]) return byId[n.id]; const full = { ...n, p3: [0, 0, 0], p2: [0, 0] } as OrbitNode; nodes.push(full); byId[n.id] = full; return full; };
  const edges: [string, string][] = [];
  const link = (a: string, b: string) => { if (a !== b) edges.push([a, b]); };
  const now = new Date(nowMs);

  // Estáticos
  STATIC_NODES.forEach((r) => add({ id: r.id, label: r.label, type: r.type, area: r.area, desc: r.desc, facts: [...(r.facts || [])], links: [...(r.links || [])] }));

  // Rotinas — o atraso mede-se contra a hora do snapshot (o snapshot pode ter minutos de idade)
  const refMs = st.generated_at ? Date.parse(st.generated_at) : nowMs;
  const crons: CronInfo[] = (st.profiles || []).flatMap((p) => (p.crons || []).map((c) => {
    const sch = parseSchedule(c.schedule);
    const owner = cronOwner(c);
    const name = c.name || c.id || 'rotina';
    const lastRun = toDate(c.last_run_at), nextRun = toDate(c.next_run_at);
    const paused = c.state === 'paused' || c.enabled === false;
    const error = c.last_status === 'error';
    const grace = Math.max(15, (sch.intervalMin || 0) * 2) * 60000;
    const stale = !paused && !!nextRun && refMs - nextRun.getTime() > grace;
    const runsToday = sch.intervalMin != null || sch.weekday == null || sch.weekday === now.getDay();
    const timeLabel = sch.intervalMin != null
      ? (sch.intervalMin < 60 ? `${sch.intervalMin} min` : `${sch.intervalMin / 60} h`)
      : sch.dailyMin != null ? `${sch.weekday != null ? WD_PT[sch.weekday] + ' ' : ''}${pad(Math.floor(sch.dailyMin / 60))}:${pad(sch.dailyMin % 60)}` : (c.schedule || '—');
    return {
      id: c.id || name, nodeId: `c:${c.id || name}`, name, owner, scheduler: c.owner || p.name || 'jarvis', area: cronArea(owner, name),
      schedule: c.schedule || '—', timeLabel, intervalMin: sch.intervalMin, dailyMin: sch.dailyMin, weekday: sch.weekday,
      runsToday, paused, stale, error, lastRun, nextRun, lastError: c.last_error || '',
      script: c.script || c.monitor_script || null, skills: c.skills || [], failureStreak: c.failure_streak || 0, pausedAt: toDate(c.paused_at),
    };
  }));

  // Perfis-agente
  const agentNames = new Set<string>([
    ...Object.keys(st.gateways || {}).filter((n) => n !== 'default'),
    ...(st.profiles || []).map((p) => p.name || '').filter((n) => n && !HUMANS.some((h) => h.name === n)),
    ...Object.keys(AGENT_INFO),
  ]);
  const profiles: ProfileInfo[] = [];
  agentNames.forEach((name) => {
    const info = AGENT_INFO[name] || { area: 'sistema' as AreaId, role: 'perfil', desc: 'Perfil Hermes.' };
    const gw = (st.gateways || {})[name] || (st.profiles || []).find((p) => p.name === name)?.gateway || null;
    const mine = crons.filter((c) => c.owner === name);
    const active = mine.filter((c) => !c.paused);
    const gwTxt = gw ? (gw.up ? `up${gw.pid ? ` · PID ${gw.pid}` : ''}` : 'down') : 'sem dados';
    const status: Status = gw?.up ? 'ok' : active.length ? 'ok' : 'off';
    const stTxt = gw?.up ? 'gateway up' : active.length ? `${active.length} rotina${active.length > 1 ? 's' : ''}` : 'sob pedido';
    const sk = Array.from(new Set(mine.flatMap((c) => c.skills)));
    add({
      id: `p:${name}`, label: name, type: 'agent', area: info.area, desc: info.desc, status,
      facts: [['Papel', info.role], ['Gateway', gwTxt], ['Rotinas', mine.length ? `${active.length} ativas · ${mine.length - active.length} pausadas` : 'Nenhuma: corre quando o jarvis delega'],
        ['Skills nas rotinas', sk.length ? sk.join(', ') : 'Nenhuma registada', sk.length > 0], ...(info.facts || []), ['Objetivos', '[Por definir]']],
      links: [],
    });
    profiles.push({ id: `p:${name}`, name, role: info.role, area: info.area, human: false, st: stTxt, status });
    if (name !== 'jarvis') link('p:jarvis', `p:${name}`);
  });
  HUMANS.forEach((h) => {
    add({ id: `p:${h.name}`, label: h.name, type: 'human', area: h.area, desc: h.desc, facts: [['Tipo', 'Perfil humano']], links: [] });
    profiles.push({ id: `p:${h.name}`, name: h.name, role: 'humano', area: h.area, human: true, st: '—', status: 'off' });
  });

  // Skills
  (st.skills || []).forEach((s) => {
    if (!s.name) return;
    const used = crons.filter((c) => c.skills.includes(s.name!));
    add({ id: `s:${s.name}`, label: s.name, type: 'skill', area: SKILL_AREA[s.name] || 'sistema', desc: s.description || 'Skill do AI OS.',
      facts: [['Instalada em', `/opt/data/profiles/jarvis/skills/vianta/${s.name}/`, true], ['Usada nas rotinas', used.length ? used.map((c) => c.name).join(', ') : 'Nenhuma: falta registar que agente a usa']], links: [] });
    link('d:skills', `s:${s.name}`);
  });

  // Nós das rotinas + ligações deduzidas
  crons.forEach((c) => {
    const status: Status = c.error ? 'err' : c.stale ? 'err' : c.paused ? 'warn' : 'ok';
    const estado = c.paused ? `Pausada${c.pausedAt ? ' ' + ago(c.pausedAt, nowMs) : ''}` : c.stale ? 'Parada: não corre desde a última execução' : c.error ? 'Erro na última execução' : 'Ativa';
    add({
      id: c.nodeId, label: c.name, type: 'cron', area: c.area, status,
      desc: `Rotina de ${c.owner} · ${c.schedule}`,
      facts: [['Perfil', c.owner, true], ...(c.scheduler !== c.owner ? [['Agendada em', c.scheduler, true] as Fact] : []), ['Agendamento', c.schedule, true], ['Estado', estado],
        ['Último resultado', c.lastRun ? `${c.error ? 'erro' : 'ok'} · ${dateTime(c.lastRun)} (${ago(c.lastRun, nowMs)})` : '—'],
        ['Próxima execução', c.paused ? '—' : c.nextRun ? `${dateTime(c.nextRun)} (${until(c.nextRun, nowMs)})` : '—'],
        ...(c.script ? [['Script', c.script, true] as Fact] : []),
        ...(c.failureStreak ? [['Falhas seguidas', String(c.failureStreak)] as Fact] : []),
        ...(c.lastError ? [['Erro', c.lastError.slice(0, 300), true] as Fact] : [])],
      links: [],
    });
    link(`p:${c.owner}`, c.nodeId);
    c.skills.forEach((s) => { if (byId[`s:${s}`]) link(c.nodeId, `s:${s}`); });
    if (c.script) {
      const sid = `x:${c.script}`;
      if (!byId[sid]) {
        add({ id: sid, label: c.script, type: 'script', area: c.area, desc: `Script chamado pela rotina «${c.name}».`,
          facts: [['Caminho', `/opt/data/profiles/jarvis/scripts/${c.script}`, true], ...(/not found/i.test(c.lastError) ? [['Estado', 'Não encontrado no servidor'] as Fact] : [])], links: [] });
        link('d:scripts', sid);
      }
      link(c.nodeId, sid);
    }
    CRON_RULES.forEach((r) => { if (r.re.test(c.name)) r.to.forEach((t) => { if (byId[t]) link(c.nodeId, t); }); });
  });
  if (byId['x:aios_snapshot.py']) link('x:aios_snapshot.py', 'x:aios-state.json');

  // Health das integrações e contagens
  const integ = st.integrations || {};
  STATIC_NODES.forEach((r) => {
    const n = byId[r.id];
    if (r.healthKey) {
      let ok: boolean | null | undefined; let note = '';
      if (r.healthKey === 'ghl') { ok = st.ghl?.ok; note = st.ghl?.status ? `health ${st.ghl.status}` : ''; }
      else if (r.healthKey === 'composio') ok = (st.mcp || []).some((m) => /composio/i.test(m.name || '')) ? true : null;
      else { ok = integ[r.healthKey]?.ok; note = integ[r.healthKey]?.note || ''; }
      n.status = ok === true ? 'ok' : ok === false ? 'err' : 'warn';
      n.facts.push(['Estado (snapshot)', ok === true ? 'OK' : ok === false ? 'Em baixo' : 'Sem health check']);
      if (note) n.facts.push(['Nota', note]);
    }
    if (r.countKeys) {
      const parts = r.countKeys.map((k) => (st.supabase || {})[k] != null ? `${k} ${(st.supabase || {})[k]}` : '').filter(Boolean);
      if (parts.length) n.facts.push(['Registos', parts.join(' · '), true]);
    }
  });

  STATIC_EDGES.forEach(([a, b]) => { if (byId[a] && byId[b]) link(a, b); });
  SKILL_EDGES.forEach(([s, t]) => { if (byId[`s:${s}`] && byId[t]) link(`s:${s}`, t); });

  // Remover ligações duplicadas
  const seen = new Set<string>();
  const uniqEdges = edges.filter(([a, b]) => {
    if (!byId[a] || !byId[b]) return false;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const adj: Record<string, string[]> = {};
  nodes.forEach((n) => { adj[n.id] = []; });
  uniqEdges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });

  // Posições 3D (por área) e 2D (anéis)
  nodes.forEach((n) => {
    if (n.type === 'hub') { n.p3 = [0, 0, 0]; return; }
    const c = ACENTER[AIDX[n.area] ?? 6];
    const f = RF[n.type] || 1;
    const j = n.type === 'agent' ? 0 : n.type === 'human' ? 30 : 78;
    const u = hash(n.id, 1) * 2 - 1, th = hash(n.id, 2) * Math.PI * 2, rr = Math.cbrt(hash(n.id, 3)) * j, sq = Math.sqrt(1 - u * u);
    n.p3 = [c[0] * f + rr * sq * Math.cos(th), c[1] * f + rr * u * 0.8, c[2] * f + rr * sq * Math.sin(th)];
    if (n.id === 'p:jarvis') n.p3 = [c[0] * 0.28, c[1] * 0.28 - 20, c[2] * 0.28];
  });
  RADII.forEach((rad) => {
    const list = nodes.filter((n) => RING[n.type] === rad).sort((a, b) => (AIDX[a.area] - AIDX[b.area]) || a.label.localeCompare(b.label));
    list.forEach((n, i) => { const a = (i / list.length) * Math.PI * 2 - Math.PI / 2; n.p2 = [Math.cos(a) * rad, Math.sin(a) * rad]; });
  });

  // Alertas por regras
  const alerts: Alert[] = [];
  const gen = toDate(st.generated_at);
  if (gen && nowMs - gen.getTime() > 25 * 60000) alerts.push({ level: 'alta', tag: 'sistema', title: 'Snapshot desatualizado', text: `O último snapshot foi gerado ${ago(gen, nowMs)}. Devia ser a cada 10 min.`, nodeId: 'x:aios-state.json' });
  crons.forEach((c) => {
    if (c.error && /not found/i.test(c.lastError)) alerts.push({ level: 'alta', tag: c.area, title: `Script em falta: ${c.name}`, text: `${c.script || 'script'} não existe no servidor${c.paused ? ' (rotina pausada)' : ''}.`, nodeId: c.nodeId });
    else if (c.error && !c.paused) alerts.push({ level: 'alta', tag: c.area, title: `Rotina com erro: ${c.name}`, text: (c.lastError || 'Erro na última execução.').slice(0, 140), nodeId: c.nodeId });
    else if (c.stale) alerts.push({ level: 'alta', tag: c.area, title: `Rotina parada: ${c.name}`, text: `Devia ter corrido ${c.nextRun ? 'a ' + dateTime(c.nextRun) : ''} e não correu${c.pausedAt ? ' (tem data de pausa, mas o estado diz agendada)' : ''}.`, nodeId: c.nodeId });
    else if (c.paused) alerts.push({ level: 'media', tag: c.area, title: `Rotina pausada: ${c.name}`, text: `Pausada ${c.pausedAt ? ago(c.pausedAt, nowMs) : ''}. Reativar ou remover.`, nodeId: c.nodeId });
    if (!c.paused && c.failureStreak >= 3) alerts.push({ level: 'media', tag: c.area, title: `Falhas seguidas: ${c.name}`, text: `${c.failureStreak} falhas seguidas.`, nodeId: c.nodeId });
  });
  STATIC_NODES.forEach((r) => { if (r.healthKey && byId[r.id].status === 'err') alerts.push({ level: 'alta', tag: r.area, title: `${r.label} em baixo`, text: 'O health check do snapshot falhou.', nodeId: r.id }); });
  (st.alerts || []).forEach((a) => alerts.push({ level: 'media', tag: 'sistema', title: 'Alerta do snapshot', text: a, nodeId: null }));
  const gwDown = Object.entries(st.gateways || {}).filter(([n, g]) => n !== 'default' && !g.up).map(([n]) => n);
  if (gwDown.length) alerts.push({ level: 'info', tag: 'sistema', title: `Gateway em baixo: ${gwDown.length} perfis`, text: `${gwDown.join(', ')}. Confirmar quais destes perfis devem ter gateway.`, nodeId: `p:${gwDown[0]}` });
  const noCron = (st.skills || []).filter((s) => s.name && !crons.some((c) => c.skills.includes(s.name!)));
  if (noCron.length) alerts.push({ level: 'info', tag: 'conhecimento', title: `${noCron.length} skills sem rotina associada`, text: 'Falta registar que agente usa cada uma.', nodeId: `s:${noCron[0].name}` });
  alerts.push({ level: 'info', tag: 'estratégia', title: 'Objetivos por agente por definir', text: 'Sem objetivos não há dashboard de performance real.', nodeId: 'p:agente-comercial' });
  const order = { alta: 0, media: 1, info: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  const areaCount: Record<string, number> = {};
  nodes.forEach((n) => { areaCount[n.area] = (areaCount[n.area] || 0) + 1; });

  return { nodes, edges: uniqEdges, byId, adj, crons, profiles, alerts, generatedAt: gen, areaCount };
}
