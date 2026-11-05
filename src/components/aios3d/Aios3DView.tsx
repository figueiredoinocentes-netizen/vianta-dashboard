import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AREAS, ACOL, ANAME, TYPE_NAME, TYPE_GROUP, SIZE, RANK, GROUP_ORDER, GROUP_NAME, type NodeType,
} from '@/data/aios-orbit-registry';
import {
  buildOrbitGraph, RADII, areaCenter3, ago, until, hhmm,
  type SnapState, type OrbitGraph, type OrbitNode, type CronInfo, type Status,
} from '@/lib/aios/orbitGraph';

/**
 * Órbita 3D — centro de comando do AI OS.
 * Dados: snapshot ao vivo (aios-state.json) + registo estático. Ver src/lib/aios/orbitGraph.ts.
 * Interação: clique fixa as ligações · 2.º clique/duplo clique abre o pop-up ·
 * shift+clique junta · arrastar roda (shift+arrastar inclina) · ctrl+scroll faz zoom.
 * Pop-ups em pilha: o que está abaixo abre ao lado, o que está acima substitui.
 */

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const HEX = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';
const DIA = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
const C = { bg: '#07090D', stage: '#080A0F', panel: '#0D1016', raised: '#11141B', line: '#1C212B', line2: '#2A303C', text: '#E6E8EC', text2: '#C9CDD4', muted: '#8B919C', faint: '#6E7480', ok: '#5FD39A', warn: '#F2C98A', err: '#FF7B6B', link: '#9DB8FF' };
const W = 1000, H = 860, CX = 500, CY = 430, F = 1600, ZMIN = 0.4, ZMAX = 3, Z0 = 1.15;

function mul(A: number[], B: number[]) { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R as number[]; }
function rotX(a: number) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function rotY(a: number) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rotZ(a: number) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
function ortho(M: number[]) {
  const nrm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const a = nrm([M[0], M[1], M[2]]); const d = a[0] * M[3] + a[1] * M[4] + a[2] * M[5];
  const b = nrm([M[3] - d * a[0], M[4] - d * a[1], M[5] - d * a[2]]);
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]];
}
const R0 = ortho(mul(rotX(-0.38), rotY(0.6)));
const clampZ = (z: number) => Math.max(ZMIN, Math.min(ZMAX, z));

function shapeOf(type: NodeType, color: string) {
  switch (type) {
    case 'hub': return { bg: '#F3F1EA', bd: '0', r: '0', clip: HEX };
    case 'agent': return { bg: color, bd: '0', r: '0', clip: HEX };
    case 'human': return { bg: 'transparent', bd: `2px solid ${color}`, r: '50%', clip: 'none' };
    case 'folder': return { bg: 'transparent', bd: `1.5px solid ${color}`, r: '2px', clip: 'none' };
    case 'skill': return { bg: color, bd: '0', r: '0', clip: DIA };
    case 'cron': return { bg: 'transparent', bd: `2px solid ${color}`, r: '50%', clip: 'none' };
    case 'integ': return { bg: color, bd: '0', r: '3px', clip: 'none' };
    case 'app': return { bg: C.bg, bd: `2.5px solid ${color}`, r: '4px', clip: 'none' };
    case 'data': case 'script': return { bg: color, bd: '0', r: '1px', clip: 'none' };
    default: return { bg: color, bd: '0', r: '50%', clip: 'none' };
  }
}
const statusColor = (s?: Status) => (s === 'ok' ? C.ok : s === 'warn' ? C.warn : s === 'err' ? C.err : C.muted);

const lbl: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.muted };
const btn = (on = false): CSSProperties => ({ cursor: 'pointer', minHeight: 32, padding: '0 10px', borderRadius: 6, border: `1px solid ${on ? '#6E7480' : C.line}`, background: 'transparent', color: on ? C.text : C.text2, fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' });
const sq: CSSProperties = { cursor: 'pointer', width: 32, minHeight: 32, borderRadius: 6, border: `1px solid ${C.line}`, background: 'transparent', color: C.text2, fontSize: 14 };

interface Panel {
  id: string; n: OrbitNode; i: number; nLinks: number; parentLabel: string | null;
  groups: { title: string; hint: string; items: { id: string; label: string; color: string; open: boolean }[] }[];
}

export default function Aios3DView({ state }: { state: SnapState | null }) {
  const graph: OrbitGraph = useMemo(() => buildOrbitGraph(state, Date.now()), [state]);
  const { nodes, edges, byId, adj } = graph;

  const [R, setR] = useState<number[]>(R0);
  const [ringRot, setRingRot] = useState(0);
  const [zoom, setZoom] = useState(Z0);
  const [view, setView] = useState<'orbit' | 'rings'>('orbit');
  const [motion, setMotion] = useState(true);
  const [names, setNames] = useState(false);
  const [area, setArea] = useState('all');
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [stack, setStack] = useState<string[]>([]);
  const [pins, setPins] = useState<string[]>([]);
  const [hov, setHov] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    const t = setInterval(() => {
      if (!motionRef.current || drag.current) return;
      setR((p) => ortho(mul(rotY(0.0035), p)));
      setRingRot((p) => p + 0.0009);
    }, 50);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  // Ctrl/Cmd + scroll (e pinch) faz zoom sem o browser fazer zoom à página
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom((z) => clampZ(z * Math.exp(-e.deltaY * 0.0015))); };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  const validStack = stack.filter((id) => byId[id]);
  const validPins = pins.filter((id) => byId[id]);
  const sel = validStack.length ? validStack[validStack.length - 1] : null;

  const proj = (p3: [number, number, number], p2: [number, number]) => {
    if (view === 'rings') {
      const a = ringRot, x = p2[0] * Math.cos(a) - p2[1] * Math.sin(a), y = p2[0] * Math.sin(a) + p2[1] * Math.cos(a);
      return { x: CX + x * zoom, y: CY + y * zoom, s: zoom, near: 0.85 };
    }
    const x1 = R[0] * p3[0] + R[1] * p3[1] + R[2] * p3[2];
    const y2 = R[3] * p3[0] + R[4] * p3[1] + R[5] * p3[2];
    const z2 = R[6] * p3[0] + R[7] * p3[1] + R[8] * p3[2];
    const s = (F / (F + z2)) * zoom;
    return { x: CX + x1 * s, y: CY + y2 * s, s, near: Math.max(0, Math.min(1, 1 - (z2 + 330) / 660)) };
  };

  // Foco: rato por cima > fixados > pop-up aberto
  const focusIds = hov && byId[hov] ? [hov] : validPins.length ? validPins : sel ? [sel] : [];
  const fidx = new Set(focusIds);
  const fset = new Set<string>();
  focusIds.forEach((id) => { fset.add(id); (adj[id] || []).forEach((x) => fset.add(x)); });
  const ql = q.trim().toLowerCase();

  const visible = nodes.filter((n) => !hidden[TYPE_GROUP[n.type]]);
  const visSet = new Set(visible.map((n) => n.id));
  const P: Record<string, ReturnType<typeof proj>> = {};
  visible.forEach((n) => { P[n.id] = proj(n.p3, n.p2); });

  const emph = (n: OrbitNode) => {
    if (focusIds.length) return fset.has(n.id) ? 1 : 0.1;
    if (ql) return n.label.toLowerCase().includes(ql) ? 1 : 0.12;
    if (area !== 'all') return n.area === area || n.type === 'hub' ? 1 : 0.07;
    return 1;
  };

  const edgeEls = edges.filter(([a, b]) => visSet.has(a) && visSet.has(b)).map(([a, b], i) => {
    const pa = P[a], pb = P[b];
    const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy);
    let c = 'rgba(230,232,236,1)', op = 0.06 + 0.1 * ((pa.near + pb.near) / 2), h = 1;
    if (focusIds.length) {
      const hA = fidx.has(a), hB = fidx.has(b);
      if (hA || hB) { c = ACOL[byId[hA ? a : b].area]; op = 0.95; h = 2; } else op = 0.025;
    } else if (ql) {
      op = byId[a].label.toLowerCase().includes(ql) || byId[b].label.toLowerCase().includes(ql) ? 0.35 : 0.03;
    } else if (area !== 'all') {
      const ia = byId[a].area === area, ib = byId[b].area === area;
      if (ia && ib) { c = ACOL[area]; op = 0.5; } else op = ia || ib ? 0.14 : 0.02;
    }
    return { key: i, l: (pa.x / W) * 100, t: (pa.y / H) * 100, w: (len / W) * 100, a: (Math.atan2(dy, dx) * 180) / Math.PI, c, op, h };
  });

  const nodeEls = visible.map((n) => {
    const p = P[n.id], sh = shapeOf(n.type, ACOL[n.area]);
    const size = SIZE[n.type] * p.s, hit = Math.max(size, 18), e = emph(n), base = 0.4 + 0.6 * p.near;
    return {
      n, p, size, l: (p.x / W) * 100, t: (p.y / H) * 100, hw: (hit / W) * 100, iw: (size / hit) * 100, sh,
      op: e === 1 ? base : e * base,
      z: Math.round(p.near * 100) + (fset.has(n.id) ? 200 : 0) + (n.type === 'hub' || n.type === 'agent' ? 50 : 0),
      ol: validStack.includes(n.id) || validPins.includes(n.id) ? `1.5px solid ${C.text}` : 'none',
    };
  });

  const labelEls = nodeEls.filter(({ n }) => {
    const important = n.type === 'hub' || n.type === 'agent';
    if (focusIds.length) return fset.has(n.id);
    if (ql) return n.label.toLowerCase().includes(ql);
    if (area !== 'all' && n.area !== area && n.type !== 'hub') return false;
    return names || important;
  }).map(({ n, p, size, op }) => {
    const important = n.type === 'hub' || n.type === 'agent';
    return { id: n.id, l: (p.x / W) * 100, t: ((p.y + size / 2) / H) * 100, text: important ? n.label.toUpperCase() : n.label, fs: important ? 11 : 10, ls: important ? 1.2 : 0, c: fidx.has(n.id) ? '#FFFFFF' : important ? C.text : C.text2, op: Math.min(1, 0.55 + 0.45 * p.near) * (op > 0.2 ? 1 : 0.4) };
  });

  const areaLabels = AREAS.map((a, i) => {
    let p;
    if (view === 'rings') {
      let sx = 0, sy = 0;
      nodes.forEach((n) => { if (n.area === a[0] && n.type !== 'hub') { const l = Math.hypot(n.p2[0], n.p2[1]) || 1; sx += n.p2[0] / l; sy += n.p2[1] / l; } });
      const l = Math.hypot(sx, sy) || 1;
      p = proj([0, 0, 0], [(sx / l) * 392, (sy / l) * 392]);
    } else {
      const c = areaCenter3(i);
      p = proj([c[0] * 1.5, c[1] * 1.5 - 26, c[2] * 1.5], [0, 0]);
    }
    const dim = (area !== 'all' && area !== a[0]) || focusIds.length > 0;
    return { id: a[0], l: (p.x / W) * 100, t: (p.y / H) * 100, label: a[1], color: a[2], count: graph.areaCount[a[0]] || 0, op: dim ? 0.25 : 0.45 + 0.55 * p.near };
  });

  const ringAng = (Math.atan2(-R[1], R[4]) * 180) / Math.PI;
  const ringMinor = Math.max(0.012, Math.abs(R[7]));
  const rings = view === 'rings'
    ? RADII.map((r) => ({ w: ((2 * r * zoom) / W) * 100, h: ((2 * r * zoom) / H) * 100, a: 0, style: 'dashed' }))
    : [370, 300].map((r) => ({ w: ((2 * r * zoom) / W) * 100, h: ((2 * r * zoom * ringMinor) / H) * 100, a: ringAng, style: 'solid' }));

  // ── Interação ──
  const open = (id: string) => { setStack([id]); setPins([id]); setHov(null); setHidden((h) => ({ ...h, [TYPE_GROUP[byId[id].type]]: false })); };
  const nodeClick = (id: string, ev: React.MouseEvent) => {
    if (drag.current?.moved) return;
    if (ev.shiftKey) { setPins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); return; }
    if (validPins.length === 1 && validPins[0] === id) { setStack([id]); setHov(null); return; }
    setPins([id]);
  };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-node],[data-ui]')) return;
    drag.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (!d.moved) return;
    const k = 0.008;
    if (view === 'rings') { setRingRot((r) => r + (dx + dy) * k); return; }
    const inc = e.shiftKey ? rotZ(dx * k) : mul(rotY(-dx * k), rotX(dy * k));
    setR((p) => ortho(mul(inc, p)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) { setPins([]); }
  };

  // ── Pop-ups em pilha ──
  const rankOf = (id: string) => (id === 'p:jarvis' ? 1 : RANK[byId[id].type]);
  const openFrom = (i: number, id: string) => {
    const j = validStack.indexOf(id);
    let ns: string[];
    if (j >= 0) ns = validStack.slice(0, j + 1);
    else if (rankOf(id) > rankOf(validStack[i])) ns = [...validStack.slice(0, i + 1), id];
    else if (rankOf(id) === rankOf(validStack[i]) && i > 0) ns = [...validStack.slice(0, i), id];
    else ns = [id];
    setStack(ns); setHov(null);
  };
  const panels: Panel[] = validStack.map((id, i) => {
    const n = byId[id];
    const nb = Array.from(new Set(adj[id] || []));
    const gm: Record<string, string[]> = {};
    nb.forEach((x) => { (gm[byId[x].type] = gm[byId[x].type] || []).push(x); });
    const my = rankOf(id);
    return {
      id, n, i, nLinks: nb.length, parentLabel: i > 0 ? byId[validStack[i - 1]].label : null,
      groups: GROUP_ORDER.filter((t) => gm[t]).map((t) => {
        const r = rankOf(gm[t][0]);
        return { title: `${GROUP_NAME[t]} · ${gm[t].length}`, hint: r > my ? '↳ abre ao lado' : r < my ? '↑ acima · substitui' : '↔ mesmo nível',
          items: gm[t].map((x) => ({ id: x, label: byId[x].label, color: ACOL[byId[x].area], open: validStack[i + 1] === x })) };
      }),
    };
  });

  // ── Barra "Fixado" ──
  let pinSummary = '';
  if (validPins.length) {
    const nbAll = new Set<string>();
    validPins.forEach((id) => (adj[id] || []).forEach((x) => nbAll.add(x)));
    validPins.forEach((id) => nbAll.delete(id));
    const cnt: Record<string, number> = {};
    nbAll.forEach((x) => { cnt[byId[x].type] = (cnt[byId[x].type] || 0) + 1; });
    pinSummary = `${nbAll.size} ligações · ` + GROUP_ORDER.filter((t) => cnt[t]).map((t) => `${GROUP_NAME[t]} ${cnt[t]}`).join(' · ');
  }

  const TYPE_CHIPS: [string, string, NodeType][] = [['agent', 'agentes', 'agent'], ['cron', 'rotinas', 'cron'], ['skill', 'skills', 'skill'], ['file', 'ficheiros', 'folder'], ['data', 'dados', 'data'], ['integ', 'integrações', 'integ'], ['app', 'apps', 'app']];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', background: C.bg, color: C.text, fontFamily: SANS, fontSize: 13, lineHeight: '18px' }}>
      <aside aria-label="Hoje" style={{ flex: '1 1 240px', maxWidth: 300, minWidth: 0, padding: '18px 20px', borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TodayPanel graph={graph} now={now} />
        <UpcomingPanel crons={graph.crons} now={now} onPick={open} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={lbl}>Perfis</span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {graph.profiles.map((p) => (
              <li key={p.id}>
                <button onClick={() => open(p.id)} aria-pressed={validPins.includes(p.id)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: validPins.includes(p.id) ? C.raised : 'transparent', border: 0, borderRadius: 6, padding: '6px 8px', color: C.text, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, flex: 'none', clipPath: p.human ? 'none' : HEX, borderRadius: p.human ? '50%' : 0, border: p.human ? `2px solid ${ACOL[p.area]}` : 0, boxSizing: 'border-box', background: p.human ? 'transparent' : ACOL[p.area] }} />
                  <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{p.role}</span>
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: statusColor(p.status), whiteSpace: 'nowrap' }}>{p.st}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ marginTop: 'auto', fontFamily: MONO, fontSize: 11, color: C.muted, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span>snapshot · {ago(graph.generatedAt, now)}</span>
          <span>estado · real, do aios-state.json</span>
        </div>
      </aside>

      <section aria-labelledby="orbit-h" style={{ flex: '999 1 480px', minWidth: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 id="orbit-h" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: MONO, fontSize: 22, lineHeight: '30px', fontWeight: 600, letterSpacing: 4 }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, clipPath: HEX, background: C.text, flex: 'none' }} />
            VIANTA AI OS <span style={{ fontFamily: SANS, fontWeight: 500, letterSpacing: 0, color: '#9085e9' }}>Agentic OS</span>
          </h2>
          <span style={{ ...lbl, letterSpacing: 2 }}>Hermes · Lisboa · centro de comando</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 10px' }}>
          <div role="group" aria-label="Vista" style={{ display: 'flex', gap: 2, padding: 2, border: `1px solid ${C.line}`, borderRadius: 6 }}>
            {(['orbit', 'rings'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} style={{ cursor: 'pointer', border: 0, borderRadius: 4, minHeight: 32, padding: '0 12px', fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', background: view === v ? C.text : 'transparent', color: view === v ? C.bg : C.text2 }}>{v === 'orbit' ? 'Órbita 3D' : 'Anéis'}</button>
            ))}
          </div>
          <button onClick={() => setMotion((m) => !m)} aria-pressed={motion} style={btn(motion)}>movimento</button>
          <div role="group" aria-label="Rodar e aproximar" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button style={sq} aria-label="Rodar para a esquerda" title="Rodar para a esquerda" onClick={() => (view === 'rings' ? setRingRot((r) => r - 0.3) : setR((p) => ortho(mul(rotY(0.3), p))))}>←</button>
            <button style={sq} aria-label="Rodar para a direita" title="Rodar para a direita" onClick={() => (view === 'rings' ? setRingRot((r) => r + 0.3) : setR((p) => ortho(mul(rotY(-0.3), p))))}>→</button>
            <button style={sq} aria-label="Rodar para cima" title="Rodar para cima" onClick={() => { setView('orbit'); setR((p) => ortho(mul(rotX(-0.3), p))); }}>↑</button>
            <button style={sq} aria-label="Rodar para baixo" title="Rodar para baixo" onClick={() => { setView('orbit'); setR((p) => ortho(mul(rotX(0.3), p))); }}>↓</button>
            <button style={sq} aria-label="Inclinar para a esquerda" title="Inclinar para a esquerda" onClick={() => (view === 'rings' ? setRingRot((r) => r - 0.3) : setR((p) => ortho(mul(rotZ(-0.3), p))))}>⟲</button>
            <button style={sq} aria-label="Inclinar para a direita" title="Inclinar para a direita" onClick={() => (view === 'rings' ? setRingRot((r) => r + 0.3) : setR((p) => ortho(mul(rotZ(0.3), p))))}>⟳</button>
            <button style={sq} aria-label="Afastar" title="Afastar" onClick={() => setZoom((z) => clampZ(z / 1.15))}>−</button>
            <button style={sq} aria-label="Aproximar" title="Aproximar" onClick={() => setZoom((z) => clampZ(z * 1.15))}>+</button>
            <button style={btn()} onClick={() => { setR(R0); setRingRot(0); setZoom(Z0); }}>repor</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${C.line}`, borderRadius: 6, padding: '0 10px', minHeight: 32, flex: '1 1 150px', minWidth: 0 }}>
            <span aria-hidden="true" style={{ color: C.muted }}>⌕</span>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Procurar asset</span>
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setStack([]); }} placeholder="procurar asset" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: C.text, fontFamily: MONO, fontSize: 12, minHeight: 30 }} />
          </label>
          <button onClick={() => setNames((n) => !n)} aria-pressed={names} style={btn(names)}>nomes</button>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{nodes.length} assets · {edges.length} ligações</span>
        </div>

        <div role="group" aria-label="Filtrar por área" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[{ id: 'all', label: 'todas', color: C.text2, count: nodes.length }, ...AREAS.map((a) => ({ id: a[0] as string, label: a[1].toLowerCase(), color: a[2] as string, count: graph.areaCount[a[0]] || 0 }))].map((a) => (
            <button key={a.id} onClick={() => { setArea(a.id); setStack([]); }} aria-pressed={area === a.id} style={{ cursor: 'pointer', minHeight: 30, padding: '0 10px', borderRadius: 6, border: `1px solid ${area === a.id ? '#6E7480' : C.line}`, background: area === a.id ? '#141821' : 'transparent', color: C.text, display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />{a.label} <span style={{ color: C.muted }}>{a.count}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label="Mostrar tipos" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TYPE_CHIPS.map(([g, label, shapeType]) => {
            const off = !!hidden[g], sh = shapeOf(shapeType, C.text2);
            return (
              <button key={g} onClick={() => setHidden((h) => ({ ...h, [g]: !off }))} aria-pressed={!off} style={{ cursor: 'pointer', minHeight: 28, padding: '0 9px', borderRadius: 6, border: `1px solid ${C.line}`, background: 'transparent', color: off ? C.faint : C.text, display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, textDecoration: off ? 'line-through' : 'none' }}>
                <span style={{ width: 10, height: 10, boxSizing: 'border-box', background: sh.bg === C.bg ? 'transparent' : sh.bg, border: sh.bd === '0' ? 0 : `1.5px solid ${C.text2}`, borderRadius: sh.r, clipPath: sh.clip }} />{label}
              </button>
            );
          })}
        </div>

        <div ref={stageRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }}
          style={{ position: 'relative', width: '100%', aspectRatio: '1000 / 860', overflow: 'hidden', border: '1px solid #141821', borderRadius: 10, background: C.stage, touchAction: 'none', cursor: 'grab', userSelect: 'none' }}>
          {rings.map((r, i) => (
            <span key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: `${r.w}%`, height: `${r.h}%`, transform: `translate(-50%, -50%) rotate(${r.a}deg)`, border: `1px ${r.style} rgba(230,232,236,0.07)`, borderRadius: '50%', boxSizing: 'border-box', pointerEvents: 'none' }} />
          ))}
          {edgeEls.map((e) => (
            <span key={e.key} style={{ position: 'absolute', left: `${e.l}%`, top: `${e.t}%`, width: `${e.w}%`, height: e.h, background: e.c, opacity: e.op, transformOrigin: '0 50%', transform: `rotate(${e.a}deg)`, pointerEvents: 'none' }} />
          ))}
          {areaLabels.map((a) => (
            <span key={a.id} style={{ position: 'absolute', left: `${a.l}%`, top: `${a.t}%`, transform: 'translate(-50%, -50%)', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: C.text2, opacity: a.op, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 300 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />{a.label} <span style={{ color: C.muted }}>{a.count}</span>
            </span>
          ))}
          {nodeEls.map((d) => (
            <button key={d.n.id} type="button" data-node={d.n.id} onClick={(e) => nodeClick(d.n.id, e)} onDoubleClick={() => open(d.n.id)}
              onMouseEnter={() => setHov(d.n.id)} onMouseLeave={() => setHov(null)} onFocus={() => setHov(d.n.id)} onBlur={() => setHov(null)}
              aria-label={`${TYPE_NAME[d.n.type]}: ${d.n.label}`} title={d.n.label}
              style={{ position: 'absolute', left: `${d.l}%`, top: `${d.t}%`, width: `${d.hw}%`, aspectRatio: '1', transform: 'translate(-50%, -50%)', padding: 0, margin: 0, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: d.op, zIndex: d.z, outline: d.ol, outlineOffset: 2 }}>
              <span style={{ display: 'block', width: `${d.iw}%`, aspectRatio: '1', boxSizing: 'border-box', background: d.sh.bg, border: d.sh.bd === '0' ? 0 : d.sh.bd, borderRadius: d.sh.r, clipPath: d.sh.clip, pointerEvents: 'none' }} />
            </button>
          ))}
          {labelEls.map((l) => (
            <span key={`l-${l.id}`} style={{ position: 'absolute', left: `${l.l}%`, top: `${l.t}%`, transform: 'translate(-50%, 0)', marginTop: 5, fontFamily: MONO, fontSize: l.fs, lineHeight: '14px', letterSpacing: l.ls, color: l.c, opacity: l.op, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 400, textShadow: `0 0 4px ${C.bg}, 0 0 2px ${C.bg}` }}>{l.text}</span>
          ))}

          {validPins.length > 0 && (
            <div data-ui="1" style={{ position: 'absolute', left: 12, top: 12, maxWidth: 'calc(100% - 24px)', zIndex: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(13,16,22,0.95)', border: `1px solid ${C.line2}`, borderRadius: 10, boxSizing: 'border-box', cursor: 'default' }}>
              <span style={{ ...lbl, fontSize: 10 }}>Fixado</span>
              {validPins.map((pid) => (
                <span key={pid} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 2px 0 8px', minHeight: 28, borderRadius: 6, background: C.raised, border: `1px solid ${C.line2}`, fontFamily: MONO, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACOL[byId[pid].area] }} />{byId[pid].label}
                  <button onClick={() => setPins((p) => p.filter((x) => x !== pid))} aria-label={`Desafixar ${byId[pid].label}`} style={{ cursor: 'pointer', width: 24, height: 24, border: 0, background: 'transparent', color: C.muted, fontSize: 14 }}>×</button>
                </span>
              ))}
              <span style={{ fontSize: 12, color: C.text2 }}>{pinSummary}</span>
              <button onClick={() => { const id = validPins[validPins.length - 1]; setStack([id]); setHov(null); }} style={{ cursor: 'pointer', minHeight: 30, padding: '0 12px', borderRadius: 6, border: `1px solid ${C.text}`, background: C.text, color: C.bg, fontSize: 12, fontWeight: 600 }}>
                {validPins.length > 1 ? `Abrir detalhe de ${byId[validPins[validPins.length - 1]].label}` : 'Abrir detalhe'}
              </button>
              <button onClick={() => setPins([])} style={btn()}>limpar</button>
            </div>
          )}
          <span style={{ position: 'absolute', right: 12, bottom: 10, left: 12, textAlign: 'right', fontFamily: MONO, fontSize: 11, color: C.faint, pointerEvents: 'none' }}>
            clique fixa as ligações · 2.º clique abre o detalhe · shift + clique junta vários · arrastar roda · shift + arrastar inclina · ctrl + scroll faz zoom
          </span>
        </div>
      </section>

      <aside aria-label="Ações e rotinas" style={{ flex: '1 1 260px', maxWidth: 340, minWidth: 0, padding: '18px 20px', borderLeft: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <NeedsPanel graph={graph} onPick={open} />
        <RoutinesPanel crons={graph.crons} now={now} sel={sel} onPick={open} />
      </aside>

      {panels.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>
          <button onClick={() => setStack([])} aria-label="Fechar todos os detalhes" style={{ position: 'absolute', inset: 0, border: 0, padding: 0, margin: 0, background: 'rgba(3,4,7,0.74)', cursor: 'default' }} />
          <div style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'stretch', maxWidth: '100%', maxHeight: '100%', overflowX: 'auto' }}>
            {panels.map((pn) => (
              <PopupPanel key={pn.id} pn={pn} wide={panels.length === 1} last={pn.i === panels.length - 1 && panels.length > 1}
                graph={graph} onOpen={(id) => openFrom(pn.i, id)} onClose={() => setStack(validStack.slice(0, pn.i))} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pop-up ──
function PopupPanel({ pn, wide, last, graph, onOpen, onClose }: { pn: Panel; wide: boolean; last: boolean; graph: OrbitGraph; onOpen: (id: string) => void; onClose: () => void }) {
  const { n } = pn;
  const audit = graph.crons.find((c) => /auditoria/i.test(c.name));
  return (
    <div role="dialog" aria-modal="true" aria-label={n.label} style={{ flex: 'none', width: wide ? 780 : 460, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', boxSizing: 'border-box', background: C.panel, border: `1px solid ${last ? '#6E7480' : C.line2}`, borderRadius: 12, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: ACOL[n.area], flex: 'none' }} />{TYPE_NAME[n.type]} · {ANAME[n.area]} · {pn.nLinks} ligações
            {n.status && <span style={{ color: statusColor(n.status) }}>· {n.status === 'ok' ? 'ok' : n.status === 'warn' ? 'atenção' : n.status === 'err' ? 'problema' : 'inativo'}</span>}
          </span>
          {pn.parentLabel && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>↳ aberto a partir de {pn.parentLabel}</span>}
        </span>
        <button onClick={onClose} aria-label={`Fechar ${n.label}`} style={{ flex: 'none', cursor: 'pointer', width: 32, height: 32, border: `1px solid ${C.line2}`, borderRadius: 6, background: 'transparent', color: C.text, fontSize: 18, lineHeight: '18px' }}>×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ margin: 0, fontFamily: MONO, fontSize: 20, lineHeight: '26px', fontWeight: 600, wordBreak: 'break-word' }}>{n.label}</h3>
        <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: C.text2 }}>{n.desc}</p>
      </div>
      {n.links.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {n.links.map(([label, url], k) => (
            <a key={url + k} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px', borderRadius: 8, background: k === 0 ? C.text : 'transparent', color: k === 0 ? C.bg : C.text, border: `1px solid ${k === 0 ? C.text : C.line2}`, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{label} <span aria-hidden="true">↗</span></a>
          ))}
        </div>
      )}
      {n.type === 'agent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, border: `1px dashed ${C.line2}`, borderRadius: 10 }}>
          <span style={lbl}>Dashboard de performance</span>
          {n.id === 'p:agente-comercial' && audit && (
            <span style={{ fontSize: 13, color: C.text2 }}>Auditoria diária «{audit.name}»: {audit.lastRun ? `último resultado ${audit.error ? 'erro' : 'ok'} ${ago(audit.lastRun)}` : 'sem execuções'} · entregue no Telegram.</span>
          )}
          <span style={{ fontSize: 13, color: C.muted }}>[Por criar] Faltam os objetivos deste agente{n.id === 'p:agente-comercial' ? ' e o JSON diário das auditorias (fase 4 do brief)' : ''}.</span>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 26px' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={lbl}>Detalhes</span>
          {[['Tipo', TYPE_NAME[n.type]] as [string, string, boolean?], ['Área', ANAME[n.area]] as [string, string, boolean?], ...n.facts].map(([k, v, mono], j) => (
            <div key={k + j} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #141821', fontSize: 13, lineHeight: '18px' }}>
              <span style={{ width: 120, flex: 'none', color: C.muted }}>{k}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', fontFamily: mono ? MONO : SANS, fontSize: mono ? 12 : 13 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={lbl}>Ligado a</span>
          {pn.groups.length === 0 && <span style={{ fontSize: 13, color: C.muted }}>Sem ligações registadas.</span>}
          {pn.groups.map((g) => (
            <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: C.text2, fontWeight: 500 }}>{g.title}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, whiteSpace: 'nowrap' }}>{g.hint}</span>
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {g.items.map((k) => (
                  <button key={k.id} onClick={() => onOpen(k.id)} aria-pressed={k.open} style={{ cursor: 'pointer', minHeight: 28, padding: '0 9px', borderRadius: 6, border: `1px solid ${k.open ? C.text : C.line2}`, background: k.open ? C.text : C.raised, color: k.open ? C.bg : C.text, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.color }} />{k.label}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Colunas laterais ──
function isToday(d: Date | null, now: number) { if (!d) return false; const a = new Date(now); return d.getFullYear() === a.getFullYear() && d.getMonth() === a.getMonth() && d.getDate() === a.getDate(); }

function TodayPanel({ graph, now }: { graph: OrbitGraph; now: number }) {
  const d = new Date(now);
  const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  const pad = (x: number) => (x < 10 ? '0' : '') + x;
  const dailies = graph.crons.filter((c) => c.dailyMin != null && c.runsToday && !c.paused).sort((a, b) => (a.dailyMin || 0) - (b.dailyMin || 0));
  const done = dailies.filter((c) => isToday(c.lastRun, now));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={lbl}>Hoje</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ position: 'relative', width: 64, height: 64, flex: 'none', borderRadius: '50%', border: '1.5px solid #3A404C', boxSizing: 'border-box' }}>
          <span style={{ position: 'absolute', left: '50%', bottom: '50%', width: 3, height: 17, marginLeft: -1.5, borderRadius: 2, background: C.text, transformOrigin: '50% 100%', transform: `rotate(${(h % 12) * 30 + m * 0.5}deg)` }} />
          <span style={{ position: 'absolute', left: '50%', bottom: '50%', width: 2, height: 25, marginLeft: -1, borderRadius: 2, background: C.text2, transformOrigin: '50% 100%', transform: `rotate(${m * 6 + s * 0.1}deg)` }} />
          <span style={{ position: 'absolute', left: '50%', bottom: '50%', width: 1, height: 27, marginLeft: -0.5, background: C.err, transformOrigin: '50% 100%', transform: `rotate(${s * 6}deg)` }} />
          <span style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, margin: '-3px 0 0 -3px', borderRadius: '50%', background: C.text }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: MONO, fontSize: 40, lineHeight: '44px', fontWeight: 500, letterSpacing: -1 }}>{pad(h)}:{pad(m)}<span style={{ fontSize: 16, color: C.muted, letterSpacing: 0 }}>:{pad(s)}</span></span>
          <span style={{ ...lbl, letterSpacing: 0.8 }}>Lisboa · {d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}>
          <span>Rotinas diárias de hoje</span>
          <span style={{ fontFamily: MONO, color: C.text }}>{done.length}/{dailies.length} disparadas</span>
        </span>
        <span style={{ display: 'flex', gap: 3 }}>
          {dailies.map((c) => { const ok = isToday(c.lastRun, now); return <span key={c.id} title={`${c.timeLabel} · ${c.name}`} style={{ flex: '1 1 0', height: 10, borderRadius: 2, background: ok ? (c.error ? C.err : C.ok) : 'transparent', border: `1px solid ${ok ? (c.error ? C.err : C.ok) : '#3A404C'}` }} />; })}
        </span>
      </div>
    </div>
  );
}

function UpcomingPanel({ crons, now, onPick }: { crons: CronInfo[]; now: number; onPick: (id: string) => void }) {
  const list = crons.filter((c) => !c.paused && !c.stale && c.nextRun && c.nextRun.getTime() > now - 60000)
    .sort((a, b) => a.nextRun!.getTime() - b.nextRun!.getTime()).slice(0, 7);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={lbl}>Próximas execuções</span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.map((c) => (
          <li key={c.id}>
            <button onClick={() => onPick(c.nodeId)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 0, padding: '5px 0', color: C.text, display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.text2, width: 42, flex: 'none' }}>{hhmm(c.nextRun!)}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{c.owner}</span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{until(c.nextRun, now)}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li style={{ fontSize: 12, color: C.muted }}>Sem execuções agendadas.</li>}
      </ul>
    </div>
  );
}

function NeedsPanel({ graph, onPick }: { graph: OrbitGraph; onPick: (id: string) => void }) {
  const urgent = graph.alerts.filter((a) => a.level !== 'info').length;
  const lc = { alta: C.err, media: C.warn, info: C.muted };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={lbl}>Precisa de ti</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 40, lineHeight: '44px', fontWeight: 500, color: urgent ? C.err : C.ok }}>{urgent}</span>
        <span style={lbl}>a resolver · {graph.alerts.length - urgent} avisos</span>
      </span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {graph.alerts.map((a, i) => (
          <li key={a.title + i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-label={`prioridade ${a.level}`} style={{ flex: 'none', width: 18, height: 18, borderRadius: 4, background: '#1A1F29', color: lc[a.level], fontFamily: MONO, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.level === 'info' ? 'i' : '!'}</span>
            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <b style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</b>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap' }}>{a.tag}</span>
              </span>
              <span style={{ fontSize: 12, lineHeight: '17px', color: C.text2 }}>{a.text}</span>
              {a.nodeId && graph.byId[a.nodeId] && <button onClick={() => onPick(a.nodeId!)} style={{ alignSelf: 'flex-start', cursor: 'pointer', border: 0, background: 'transparent', padding: '2px 0', color: C.link, fontSize: 12 }}>ver detalhe</button>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function routineStatus(c: CronInfo, now: number, nextDailyId: string | null): [string, string] {
  if (c.paused) return [c.error ? 'PAUSADA · ERRO' : 'PAUSADA', c.error ? C.err : C.warn];
  if (c.stale) return ['PARADA', C.err];
  if (c.error) return ['ERRO', C.err];
  if (c.intervalMin != null) return [`OK · ${ago(c.lastRun, now).replace('há ', '')}`, C.ok];
  if (!c.runsToday) return ['AGENDADA', C.text2];
  if (isToday(c.lastRun, now)) return [`DISPAROU ${c.lastRun ? hhmm(c.lastRun) : ''}`, C.ok];
  if (c.id === nextDailyId) return ['PRÓXIMA', '#FFFFFF'];
  return ['AGENDADA', C.text2];
}

function RoutinesPanel({ crons, now, sel, onPick }: { crons: CronInfo[]; now: number; sel: string | null; onPick: (id: string) => void }) {
  const order = (c: CronInfo) => (c.paused ? 3000 : 0) + (c.dailyMin != null ? c.dailyMin : 2000 + (c.intervalMin || 0));
  const list = [...crons].sort((a, b) => order(a) - order(b));
  const nextDaily = crons.filter((c) => c.dailyMin != null && c.runsToday && !c.paused && !isToday(c.lastRun, now)).sort((a, b) => (a.dailyMin || 0) - (b.dailyMin || 0))[0];
  const active = crons.filter((c) => !c.paused).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={lbl}>Rotinas</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{active}/{crons.length} ativas</span>
      </span>
      <div style={{ display: 'flex', fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C.faint, paddingBottom: 4, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ width: 56, flex: 'none' }}>Hora</span><span style={{ flex: '1 1 auto' }}>Rotina</span><span>Estado</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {list.map((c) => {
          const [st, col] = routineStatus(c, now, nextDaily?.id || null);
          return (
            <li key={c.id}>
              <button onClick={() => onPick(c.nodeId)} title={c.name} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: sel === c.nodeId ? '#141821' : 'transparent', border: 0, borderBottom: '1px solid #12161E', padding: '7px 4px', color: C.text, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, lineHeight: '16px' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.text2, width: 52, flex: 'none' }}>{c.timeLabel}</span>
                <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name.replace(/^\[bot:[^\]]+\]\s*/, '')}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{c.owner}</span>
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.6, fontWeight: 600, color: col, whiteSpace: 'nowrap' }}>{st}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
