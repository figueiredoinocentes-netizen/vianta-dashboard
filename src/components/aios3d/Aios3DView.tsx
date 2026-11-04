import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ALL_NODES, EDGES_DATA, CRONS_DATA, AREAS, AIDX, ACOL, ANAME,
  TYPE_NAME, SIZE, BYID, ADJ,
  type AiosNode, type NodeType, type AreaId,
} from '@/data/aios-3d-data';

const HEX = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';
const DIA = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';

// ── Matrix helpers (from prototype) ──
function mul(A: number[], B: number[]): number[] {
  const C = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return C;
}
function rotX(a: number): number[] { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function rotY(a: number): number[] { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rotZ(a: number): number[] { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
function ortho(M: number[]): number[] {
  const nrm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const a = nrm([M[0], M[1], M[2]]);
  const d = a[0] * M[3] + a[1] * M[4] + a[2] * M[5];
  const b = nrm([M[3] - d * a[0], M[4] - d * a[1], M[5] - d * a[2]]);
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]];
}
const R0 = ortho(mul(rotX(-0.38), rotY(0.6)));

// ── Layout: 3D positions (fibonacci-like deterministic) ──
function rnd(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const RF: Record<string, number> = { agent: 0.42, human: 0.7, folder: 1.05, file: 1.22, script: 1, data: 1.1, skill: 1, cron: 0.82, integ: 0.92, app: 0.78 };
const ACENTER = AREAS.map((_, i) => {
  const y = 1 - ((i + 0.5) / AREAS.length) * 2;
  const r = Math.sqrt(1 - y * y);
  const th = i * 2.39996 + 0.6;
  return [Math.cos(th) * r * 230, y * 150, Math.sin(th) * r * 230] as number[];
});
const P3: Record<string, [number, number, number]> = {};
ALL_NODES.forEach((n, i) => {
  if (n.type === 'hub') { P3[n.id] = [0, 0, 0]; return; }
  const c = ACENTER[AIDX[n.area] ?? 0];
  const f = RF[n.type] || 1;
  const j = n.type === 'agent' ? 0 : n.type === 'human' ? 30 : 72;
  const u = rnd(i, 1) * 2 - 1, th = rnd(i, 2) * Math.PI * 2, rr = Math.cbrt(rnd(i, 3)) * j, sq = Math.sqrt(1 - u * u);
  const p: [number, number, number] = [c[0] * f + rr * sq * Math.cos(th), c[1] * f + rr * u * 0.8, c[2] * f + rr * sq * Math.sin(th)];
  if (n.id === 'jarvis') { p[0] = c[0] * 0.28; p[1] = c[1] * 0.28 - 20; p[2] = c[2] * 0.28; }
  P3[n.id] = p;
});
// 2D ring positions
const RING: Record<string, number> = { hub: 0, agent: 95, human: 95, cron: 175, integ: 175, app: 175, skill: 255, folder: 330, file: 330, script: 330, data: 330 };
const P2: Record<string, [number, number]> = {};
[95, 175, 255, 330].forEach(rad => {
  const list = ALL_NODES.filter(n => (RING[n.type] ?? 330) === rad).sort((a, b) => (AIDX[a.area] ?? 0) - (AIDX[b.area] ?? 0));
  list.forEach((n, i) => { const a = (i / list.length) * Math.PI * 2 - Math.PI / 2; P2[n.id] = [Math.cos(a) * rad, Math.sin(a) * rad]; });
});
ALL_NODES.forEach(n => { if (!P2[n.id]) P2[n.id] = [0, 0]; });
const ALABEL2 = AREAS.map(a => {
  let sx = 0, sy = 0;
  ALL_NODES.forEach(n => { if (n.area === a[0] && n.type !== 'hub') { const p = P2[n.id]; const l = Math.hypot(p[0], p[1]) || 1; sx += p[0] / l; sy += p[1] / l; } });
  const l = Math.hypot(sx, sy) || 1;
  return [sx / l * 392, sy / l * 392] as number[];
});

// shape by type
function shapeOf(type: NodeType, color: string) {
  switch (type) {
    case 'hub': return { bg: '#F3F1EA', bd: '0', r: '0', clip: HEX };
    case 'agent': return { bg: color, bd: '0', r: '0', clip: HEX };
    case 'human': return { bg: 'transparent', bd: `2px solid ${color}`, r: '50%', clip: 'none' };
    case 'folder': return { bg: 'transparent', bd: `1.5px solid ${color}`, r: '2px', clip: 'none' };
    case 'skill': return { bg: color, bd: '0', r: '0', clip: DIA };
    case 'cron': return { bg: 'transparent', bd: `2px solid ${color}`, r: '50%', clip: 'none' };
    case 'integ': return { bg: color, bd: '0', r: '3px', clip: 'none' };
    case 'app': return { bg: '#07090D', bd: `2.5px solid ${color}`, r: '4px', clip: 'none' };
    case 'data': return { bg: color, bd: '0', r: '1px', clip: 'none' };
    case 'script': return { bg: color, bd: '0', r: '1px', clip: 'none' };
    default: return { bg: color, bd: '0', r: '50%', clip: 'none' };
  }
}

interface ViewProps {
  onNodeSelect?: (id: string | null) => void;
  externalState?: any;
}

export default function Aios3DView({ onNodeSelect, externalState }: ViewProps) {
  const [R, setR] = useState<number[]>(R0);
  const [ringRot, setRingRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<'orbit' | 'rings'>('orbit');
  const [motion, setMotion] = useState(true);
  const [names, setNames] = useState(false);
  const [area, setArea] = useState('all');
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [stack, setStack] = useState<string[]>([]);
  const [pins, setPins] = useState<string[]>([]);
  const [hov, setHov] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState(0);
  const timerRef = useRef<number | null>(null);
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; sR: number[] } | null>(null);
  const dragNodeRef = useRef<string | null>(null);

  // Auto-rotation
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setR(prev => (motion && !dragRef.current?.active) ? ortho(mul(rotY(0.0035), prev)) : prev);
      if (motion && !dragRef.current?.active) setRingRot(p => p + 0.0009);
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [motion]);

  const proj = (p3: [number, number, number], p2: [number, number]) => {
    const W = 1000, H = 860, CX = 500, CY = 430, F = 1600;
    if (view === 'rings') {
      const a = ringRot;
      const x = p2[0] * Math.cos(a) - p2[1] * Math.sin(a);
      const y = p2[0] * Math.sin(a) + p2[1] * Math.cos(a);
      return { x: CX + x * zoom, y: CY + y * zoom, s: zoom, near: 0.85 };
    }
    const x1 = R[0] * p3[0] + R[1] * p3[1] + R[2] * p3[2];
    const y2 = R[3] * p3[0] + R[4] * p3[1] + R[5] * p3[2];
    const z2 = R[6] * p3[0] + R[7] * p3[1] + R[8] * p3[2];
    const s = (F / (F + z2)) * zoom;
    return { x: CX + x1 * s, y: CY + y2 * s, s, near: Math.max(0, Math.min(1, 1 - (z2 + 330) / 660)) };
  };

  // Derived
  const visible = ALL_NODES.filter(n => !hidden[TYPE_NAME[n.type]]);
  const visSet = new Set(visible.map(n => n.id));
  const focusIds = hov ? [hov] : pins.length ? pins : (stack.length ? [stack[stack.length - 1]] : []);
  const focus = focusIds.length ? focusIds[0] : null;
  const fset = new Set<string>();
  focusIds.forEach(id => { fset.add(id); (ADJ[id] || []).forEach(x => fset.add(x)); });
  const ql = q.trim().toLowerCase();

  const emph = (n: AiosNode) => {
    if (focus) return fset.has(n.id) ? 1 : 0.1;
    if (ql) return n.label.toLowerCase().includes(ql) ? 1 : 0.12;
    if (area !== 'all') return n.area === area || n.type === 'hub' ? 1 : 0.07;
    return 1;
  };

  const nodes = visible.map(n => {
    const p = proj(P3[n.id], P2[n.id]);
    const color = ACOL[n.area];
    const sh = shapeOf(n.type, color);
    const size = (SIZE[n.type] || 10) * p.s;
    const hit = Math.max(size, 18);
    const e = emph(n);
    const base = 0.4 + 0.6 * p.near;
    const Wp = 1000, Hp = 860;
    return {
      n,
      l: (p.x / Wp) * 100, t: (p.y / Hp) * 100,
      hw: (hit / Wp) * 100, iw: (size / hit) * 100,
      bg: sh.bg, bd: sh.bd, r: sh.r, clip: sh.clip,
      op: e === 1 ? base : e * base,
      z: Math.round(p.near * 100) + (fset.has(n.id) ? 200 : 0) + (n.type === 'hub' || n.type === 'agent' ? 50 : 0),
      ol: stack.includes(n.id) || pins.includes(n.id) ? '1.5px solid #E6E8EC' : 'none',
      near: p.near, p,
    };
  });

  const edges = [] as any[];
  EDGES_DATA.forEach(ed => {
    if (!visSet.has(ed.source) || !visSet.has(ed.target)) return;
    const a = proj(P3[ed.source], P2[ed.source]);
    const b = proj(P3[ed.target], P2[ed.target]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const na = BYID[ed.source], nb = BYID[ed.target];
    let c = 'rgba(230,232,236,1)', op = 0.06 + 0.1 * ((a.near + b.near) / 2);
    if (focus) {
      const hA = fset.has(ed.source), hB = fset.has(ed.target);
      if (hA || hB) { c = ACOL[BYID[hA ? ed.source : ed.target].area]; op = 0.75; }
      else op = 0.02;
    } else if (ql) {
      op = (na.label.toLowerCase().includes(ql) || nb.label.toLowerCase().includes(ql)) ? 0.35 : 0.03;
    } else if (area !== 'all') {
      if (na.area === area && nb.area === area) { c = ACOL[area]; op = 0.5; }
      else op = 0.04;
    }
    if (len > 1 && op > 0.01 && a.x > 0 && a.y > 0 && b.x > 0 && b.y > 0) {
      edges.push({
        l: (a.x / 1000) * 100, t: (a.y / 860) * 100,
        w: (len / 1000) * 100,
        c, op, a: Math.atan2(dy, dx) * 180 / Math.PI,
      });
    }
  });

  // handlers
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(z => Math.max(0.4, Math.min(3, z * Math.exp(-e.deltaY * 0.0015))));
  };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) { dragNodeRef.current = (e.target as HTMLElement).closest('[data-node]')!.getAttribute('data-node'); return; }
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, sR: [...R] };
    setDragKey(k => k + 1);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d?.active) {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      setR(ortho(mul(rotY(dx * 0.005), mul(rotX(dy * 0.005), d.sR))));
    }
  };
  const onUp = () => { dragRef.current = null; dragNodeRef.current = null; };

  const nodeClick = (id: string, ev: React.MouseEvent) => {
    if (ev.shiftKey) {
      setPins(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    if (pins.length === 1 && pins[0] === id) { setStack([id]); setHov(null); }
    else setPins([id]);
    onNodeSelect?.(id);
  };

  const toggleHidden = (t: string) => setHidden(h => ({ ...h, [t]: !h[t] }));

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', background: '#07090D', color: '#E6E8EC', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, lineHeight: '18px', minHeight: '70vh' }}>

      {/* ── LEFT: Hoje ── */}
      <aside style={{ flex: '1 1 260px', maxWidth: 320, minWidth: 0, padding: '18px 20px', borderRight: '1px solid #1C212B', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ClockPanel />
        <UpcomingPanel pins={pins} stack={stack} onPick={(id) => { setPins([id]); onNodeSelect?.(id); }} />
        <ProfilesPanel pins={pins} onPick={(id) => { setPins([id]); onNodeSelect?.(id); }} />
        <div style={{ marginTop: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8B919C' }}>
          <span>telegram · gateway ativo</span><br />
          <span>google · via Composio desde 23/10</span><br />
          <span>estado · simulado a partir do agendamento</span>
        </div>
      </aside>

      {/* ── CENTER: Órbita ── */}
      <section aria-labelledby="graph-h" style={{ flex: '999 1 560px', minWidth: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 id="graph-h" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, lineHeight: '30px', fontWeight: 600, letterSpacing: 4 }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, clipPath: HEX, background: '#E6E8EC', flex: 'none' }}></span>
            VIANTA AI OS <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, letterSpacing: 0, color: '#9085e9' }}>Agentic OS</span>
          </h1>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#8B919C' }}>Hermes · Lisboa · centro de comando</span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>Vista</span>
          <div role="group" aria-label="Vista" style={{ display: 'flex', gap: 2, padding: 2, border: '1px solid #1C212B', borderRadius: 6 }}>
            {[['orbit', 'órbita'], ['rings', 'anéis']].map(([v, lbl]) => (
              <button key={v} onClick={() => setView(v as any)} aria-pressed={view === v}
                style={{ cursor: 'pointer', border: 0, borderRadius: 4, minHeight: 32, padding: '0 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', background: view === v ? '#E6E8EC' : 'transparent', color: view === v ? '#07090D' : '#8B919C' }}>{lbl}</button>
            ))}
          </div>
          <button onClick={() => setMotion(m => !m)} aria-pressed={motion}
            style={{ cursor: 'pointer', minHeight: 32, padding: '0 12px', borderRadius: 6, border: `1px solid ${motion ? '#5FD39A' : '#1C212B'}`, background: 'transparent', color: motion ? '#5FD39A' : '#8B919C', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>movimento</button>
          <div role="group" aria-label="Rodar e aproximar" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[
              ['←', () => setR(ortho(mul(rotY(-0.15), R)))],
              ['→', () => setR(ortho(mul(rotY(0.15), R)))],
              ['↑', () => setR(ortho(mul(rotX(0.15), R)))],
              ['↓', () => setR(ortho(mul(rotX(-0.15), R)))],
              ['⟲', () => setR(ortho(mul(rotZ(-0.15), R)))],
              ['⟳', () => setR(ortho(mul(rotZ(0.15), R)))],
            ].map((item, i) => {
              const lbl = item[0] as string;
              const fn = item[1] as () => void;
              return (
                <button key={i} onClick={fn} style={{ cursor: 'pointer', width: 32, minHeight: 32, borderRadius: 6, border: '1px solid #1C212B', background: 'transparent', color: '#C9CDD4', fontSize: 14 }}>{lbl}</button>
              );
            })}
            <button onClick={() => setZoom(z => Math.max(0.4, z / 1.2))} style={{ cursor: 'pointer', width: 32, minHeight: 32, borderRadius: 6, border: '1px solid #1C212B', background: 'transparent', color: '#C9CDD4', fontSize: 14 }}>−</button>
            <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={{ cursor: 'pointer', width: 32, minHeight: 32, borderRadius: 6, border: '1px solid #1C212B', background: 'transparent', color: '#C9CDD4', fontSize: 14 }}>+</button>
            <button onClick={() => { setR(R0); setZoom(1); }} style={{ cursor: 'pointer', minHeight: 32, padding: '0 10px', borderRadius: 6, border: '1px solid #1C212B', background: 'transparent', color: '#C9CDD4', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>repor</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #1C212B', borderRadius: 6, padding: '0 10px', minHeight: 32, flex: '1 1 160px', minWidth: 0 }}>
            <span aria-hidden="true" style={{ flex: 'none', color: '#8B919C', fontSize: 13 }}>⌕</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="procurar asset"
              style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: '#E6E8EC', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, minHeight: 30 }} />
          </label>
          <button onClick={() => setNames(n => !n)} aria-pressed={names}
            style={{ cursor: 'pointer', minHeight: 32, padding: '0 12px', borderRadius: 6, border: `1px solid ${names ? '#E6E8EC' : '#1C212B'}`, background: 'transparent', color: names ? '#E6E8EC' : '#8B919C', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>nomes</button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8B919C', whiteSpace: 'nowrap' }}>{ALL_NODES.length} assets · {EDGES_DATA.length} ligações</span>
        </div>

        {/* Area chips */}
        <div role="group" aria-label="Filtrar por área" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[['all', 'Todas', '#8B919C', ALL_NODES.length], ...AREAS.map(a => {
            const cnt = ALL_NODES.filter(n => n.area === a[0]).length;
            return [a[0], a[1], a[2], cnt] as any;
          })].map(([val, lbl, color, cnt]) => (
            <button key={val} onClick={() => setArea(val)}
              style={{ cursor: 'pointer', minHeight: 30, padding: '0 10px', borderRadius: 6, border: `1px solid ${area === val ? color : '#1C212B'}`, background: area === val ? color + '22' : 'transparent', color: '#E6E8EC', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' }}></span>{lbl} <span style={{ color: '#8B919C' }}>{cnt}</span>
            </button>
          ))}
        </div>

        {/* Type toggles */}
        <div role="group" aria-label="Mostrar tipos" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(TYPE_NAME).filter(([t]) => t !== 'hub').map(([t, lbl]) => {
            const on = !hidden[t];
            return (
              <button key={t} onClick={() => toggleHidden(t)} aria-pressed={on}
                style={{ cursor: 'pointer', minHeight: 28, padding: '0 9px', borderRadius: 6, border: '1px solid #1C212B', background: 'transparent', color: on ? '#E6E8EC' : '#4A505C', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textDecoration: on ? 'none' : 'line-through' }}>
                <span style={{ width: 9, height: 9, boxSizing: 'border-box', background: on ? ACOL[AREAS[0][0]] : 'transparent', border: on ? '0' : '1px solid #4A505C', borderRadius: '50%', display: 'inline-block' }}></span>{lbl}
              </button>
            );
          })}
        </div>

        {/* Stage */}
        <div onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          style={{ position: 'relative', width: '100%', aspectRatio: '1000 / 860', overflow: 'hidden', border: '1px solid #141821', borderRadius: 10, background: '#080A0F', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}>

          {/* rings */}
          {view === 'rings' && [95, 175, 255, 330].map(rad => (
            <span key={rad} style={{ position: 'absolute', left: (500 / 1000) * 100, top: (430 / 860) * 100, width: (rad * 2 * zoom / 1000) * 100, height: (rad * 2 * zoom / 860) * 100, transform: 'translate(-50%, -50%)', border: '1px solid rgba(230,232,236,0.07)', borderRadius: '50%', boxSizing: 'border-box', pointerEvents: 'none' }}></span>
          ))}

          {/* edges */}
          {edges.map((e, i) => (
            <span key={i} style={{ position: 'absolute', left: e.l + '%', top: e.t + '%', width: e.w + '%', height: 0.7, background: e.c, opacity: e.op, transformOrigin: '0 50%', transform: `rotate(${e.a}deg)`, pointerEvents: 'none' }}></span>
          ))}

          {/* area labels */}
          {view === 'rings' && AREAS.map((a, i) => (
            <span key={a[0]} style={{ position: 'absolute', left: (ALABEL2[i][0] + 500) / 1000 * 100 + '%', top: (ALABEL2[i][1] + 430) / 860 * 100 + '%', transform: 'translate(-50%, -50%)', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#C9CDD4', opacity: 0.8, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 300 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: a[2] }}></span>{a[1]} <span style={{ color: '#8B919C' }}>{ALL_NODES.filter(n => n.area === a[0] && n.type !== 'hub').length}</span>
            </span>
          ))}

          {/* nodes */}
          {nodes.map(nd => {
            const { n } = nd;
            return (
              <button key={n.id} type="button" data-node={n.id}
                onClick={(e) => nodeClick(n.id, e)}
                onDoubleClick={() => { setPins([n.id]); setStack([n.id]); onNodeSelect?.(n.id); }}
                onMouseEnter={() => setHov(n.id)} onMouseLeave={() => setHov(null)}
                aria-label={`${TYPE_NAME[n.type]}: ${n.label}`}
                title={`${n.desc}`}
                style={{ position: 'absolute', left: nd.l + '%', top: nd.t + '%', width: nd.hw + '%', aspectRatio: 1, transform: 'translate(-50%, -50%)', padding: 0, margin: 0, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: nd.op, zIndex: nd.z, outline: nd.ol, outlineOffset: 2 }}>
                <span style={{ display: 'block', width: nd.iw + '%', aspectRatio: 1, boxSizing: 'border-box', background: nd.bg, border: nd.bd, borderRadius: nd.r, clipPath: nd.clip, pointerEvents: 'none' }}></span>
              </button>
            );
          })}

          {/* labels */}
          {names && nodes.filter(nd => nd.op > 0.3).map(nd => (
            <span key={'l' + nd.n.id} style={{ position: 'absolute', left: nd.l + '%', top: nd.t + '%', transform: 'translate(-50%, 0)', marginTop: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: Math.max(8, 10 * Math.min(1, nd.p.s * 1.5)) + 'px', lineHeight: '14px', color: '#E6E8EC', opacity: Math.min(1, nd.op * 1.5), whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 400, textShadow: '0 0 4px #07090D, 0 0 2px #07090D' }}>{nd.n.label}</span>
          ))}

          {/* pinned bar */}
          {pins.length > 0 && (
            <div onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', left: 12, top: 12, maxWidth: 'calc(100% - 24px)', zIndex: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(13,16,22,0.95)', border: '1px solid #2A303C', borderRadius: 10, cursor: 'default' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>Fixado</span>
              {pins.map(pid => (
                <span key={pid} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 2px 0 8px', minHeight: 28, borderRadius: 6, background: '#11141B', border: '1px solid #2A303C', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#E6E8EC' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACOL[BYID[pid]?.area] }}></span>{BYID[pid]?.label}
                  <button onClick={() => setPins(prev => prev.filter(x => x !== pid))} aria-label={`Desafixar ${BYID[pid]?.label}`} style={{ cursor: 'pointer', width: 24, height: 24, border: 0, background: 'transparent', color: '#8B919C', fontSize: 14 }}>×</button>
                </span>
              ))}
              <span style={{ fontSize: 12, color: '#C9CDD4' }}>{pins.length} fixado(s)</span>
              <button onClick={() => { setPins([]); setStack([]); onNodeSelect?.(null); }} style={{ cursor: 'pointer', minHeight: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #2A303C', background: 'transparent', color: '#C9CDD4', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>limpar</button>
            </div>
          )}

          <span style={{ position: 'absolute', right: 12, bottom: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6E7480', pointerEvents: 'none' }}>
            clique fixa as ligações · 2.º clique abre o detalhe · shift + clique junta vários · arrastar roda · ctrl + scroll faz zoom
          </span>
        </div>
      </section>

      {/* ── RIGHT: Ações e rotinas ── */}
      <aside aria-label="Ações e rotinas" style={{ flex: '1 1 280px', maxWidth: 360, minWidth: 0, padding: '18px 20px', borderLeft: '1px solid #1C212B', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <NeedsPanel pins={pins} stack={stack} onPick={(id) => { setPins([id]); onNodeSelect?.(id); }} />
        <RoutinesPanel pins={pins} onPick={(id) => { setPins([id]); onNodeSelect?.(id); }} />
      </aside>
    </div>
  );
}

// ── Small presentational sub-components ──

function ClockPanel() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const hDeg = (h % 12) * 30 + m * 0.5;
  const mDeg = m * 6 + s * 0.1;
  const sDeg = s * 6;
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  const dateShort = now.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' });
  const dailyTotal = CRONS_DATA.length;
  const dailyDone = dailyTotal - 3;
  const dailyBlocks = CRONS_DATA.map(c => {
    const ok = !c.paused;
    return { title: c.label, bg: ok ? '#1A1F29' : '#12161E', bd: ok ? '#2A303C' : '#1A1F29' };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>Hoje</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ position: 'relative', width: 64, height: 64, flex: 'none', borderRadius: '50%', border: '1.5px solid #3A404C', boxSizing: 'border-box' }}>
          <span style={{ position: 'absolute', left: '50%', bottom: '50%', width: 3, height: 17, marginLeft: -1.5, borderRadius: 2, background: '#E6E8EC', transformOrigin: '50% 100%', transform: `rotate(${hDeg}deg)` }}></span>
          <span style={{ position: 'absolute', left: '50%', bottom: '50%', width: 2, height: 25, marginLeft: -1, borderRadius: 2, background: '#C9CDD4', transformOrigin: '50% 100%', transform: `rotate(${mDeg}deg)` }}></span>
          <span style={{ position: 'absolute', left: '50%', bottom: '50%', width: 1, height: 27, marginLeft: -0.5, background: '#FF7B6B', transformOrigin: '50% 100%', transform: `rotate(${sDeg}deg)` }}></span>
          <span style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, margin: '-3px 0 0 -3px', borderRadius: '50%', background: '#E6E8EC' }}></span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, lineHeight: '44px', fontWeight: 500, letterSpacing: -1 }}>{pad(h)}:{pad(m)}<span style={{ fontSize: 16, color: '#8B919C', letterSpacing: 0 }}>:{pad(s)}</span></span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#8B919C' }}>Lisboa · {dateShort}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8B919C' }}>
          <span>Rotinas diárias</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E6E8EC' }}>{dailyDone}/{dailyTotal} disparadas</span>
        </span>
        <span style={{ display: 'flex', gap: 3 }}>
          {dailyBlocks.map((b, i) => <span key={i} title={b.title} style={{ flex: '1 1 0', height: 10, borderRadius: 2, background: b.bg, border: `1px solid ${b.bd}` }}></span>)}
        </span>
      </div>
    </div>
  );
}

function UpcomingPanel({ pins, stack, onPick }: { pins: string[]; stack: string[]; onPick: (id: string) => void }) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = CRONS_DATA
    .filter(c => !c.paused)
    .map(c => {
      let t = 0;
      if (c.time) t = parseInt(c.time.split(':')[0]) * 60 + parseInt(c.time.split(':')[1]);
      else t = nowMin + (c.intervalMin ?? 60);
      const diff = t - nowMin;
      return { c, t, diff };
    })
    .filter(x => x.diff >= 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 7)
    .map(x => {
      const pad = (n: number) => (n < 10 ? '0' : '') + n;
      const owner = x.c.owner === 'jarvis' ? 'jarvis' : BYID[x.c.owner]?.label || x.c.owner;
      return {
        id: x.c.id,
        time: x.c.time ? x.c.time : `${pad(Math.floor(x.t / 60))}:${pad(x.t % 60)} (aprox.)`,
        name: x.c.label,
        owner,
        inn: x.diff < 60 ? `em ${Math.max(0, Math.round(x.diff))} min` : `em ${Math.floor(x.diff / 60)}h${pad(Math.round(x.diff % 60))}`,
      };
    });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>Próximas execuções</span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {upcoming.map(u => (
          <li key={u.id}>
            <button onClick={() => onPick(u.id)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 0, padding: '6px 0', color: '#E6E8EC', display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13, lineHeight: '18px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#C9CDD4', width: 42, flex: 'none' }}>{u.time}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8B919C' }}>{u.owner}</span>
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8B919C', whiteSpace: 'nowrap' }}>{u.inn}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfilesPanel({ pins, onPick }: { pins: string[]; onPick: (id: string) => void }) {
  const profiles = [
    { id: 'jarvis', name: 'jarvis', role: 'CEO · orquestrador', st: 'ativo', stColor: '#5FD39A', color: '#9085e9' },
    { id: 'ag-com', name: 'agente-comercial', role: 'leads TVDE', st: 'ativo', stColor: '#5FD39A', color: '#3987e5' },
    { id: 'ag-tur', name: 'agente-turismo', role: 'ChoiceCar', st: 'ativo', stColor: '#5FD39A', color: '#199e70' },
    { id: 'ag-med', name: 'media-buyer', role: 'anúncios Meta', st: 'ferramenta', stColor: '#F2C98A', color: '#d95926' },
    { id: 'ag-con', name: 'agente-conteudo', role: 'conteúdo', st: 'inativo', stColor: '#6E7480', color: '#d95926' },
    { id: 'h-fra', name: 'francisco', role: 'humano', st: '—', stColor: '#8B919C', color: '#9085e9' },
    { id: 'h-dua', name: 'duarte', role: 'humano', st: '—', stColor: '#8B919C', color: '#199e70' },
    { id: 'h-via', name: 'vianta', role: 'equipa', st: '—', stColor: '#8B919C', color: '#9085e9' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>Perfis</span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {profiles.map(p => {
          const isSel = pins.includes(p.id);
          return (
            <li key={p.id}>
              <button onClick={() => onPick(p.id)} aria-pressed={isSel}
                style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: isSel ? '#11141B' : 'transparent', border: 0, borderRadius: 6, padding: '7px 8px', color: '#E6E8EC', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span style={{ width: 12, height: 12, flex: 'none', clipPath: HEX, background: p.color }}></span>
                <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: '#8B919C' }}>{p.role}</span>
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: p.stColor, whiteSpace: 'nowrap' }}>{p.st}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NeedsPanel({ pins, stack, onPick }: { pins: string[]; stack: string[]; onPick: (id: string) => void }) {
  const needs = [
    { title: 'Scripts em falta: 2 rotinas' , tag: 'sistema', text: 'Newsletter replies e ChoiceCar pipeline apontam para ficheiros inexistentes.', node: 'c12' },
    { title: 'ChoiceCar sync check pausado há 6 dias', tag: 'turismo', text: 'O fluxo de sync de transfers pode estar parado.', node: 'c11' },
    { title: 'Snapshot atrasado', tag: 'sistema', text: 'Última execução foi há mais de 10 min. Verificar cron.', node: 'c7' },
    { title: 'Meta Ads: cartão "sem token"', tag: 'marketing', text: 'Confirmar se o cron de spend está a escrever dados.', node: 'c6' },
    { title: 'agente-comercial mostra "gateway down"', tag: 'sistema', text: 'Deve mostrar "sem gateway" — o perfil não tem gateway por design.', node: 'ag-com' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>Precisa de ti</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, lineHeight: '44px', fontWeight: 500, color: '#FF7B6B' }}>{needs.length}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>ações em aberto</span>
      </span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {needs.map(nd => (
          <li key={nd.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 18, height: 18, borderRadius: 4, background: '#1A1F29', color: '#FF7B6B', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>
            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <b style={{ fontWeight: 600, fontSize: 13 }}>{nd.title}</b>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: '#8B919C', whiteSpace: 'nowrap' }}>{nd.tag}</span>
              </span>
              <span style={{ fontSize: 12, lineHeight: '17px', color: '#C9CDD4' }}>{nd.text}</span>
              <button onClick={() => onPick(nd.node)} style={{ alignSelf: 'flex-start', cursor: 'pointer', border: 0, background: 'transparent', padding: '2px 0', color: '#9DB8FF', fontSize: 12 }}>ver detalhe</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoutinesPanel({ pins, onPick }: { pins: string[]; onPick: (id: string) => void }) {
  const routines = CRONS_DATA.map(c => {
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    const time = c.time || (c.intervalMin ? `cada ${c.intervalMin === 1 ? '1min' : c.intervalMin + 'min'}` : '—');
    const owner = c.owner === 'jarvis' ? 'jarvis' : BYID[c.owner]?.label.split('-').slice(0, 2).join('-') || c.owner;
    const st = c.paused ? 'pausada' : 'ok';
    const stColor = c.paused ? '#F2C98A' : '#5FD39A';
    return { id: c.id, time, name: c.label, owner, st, stColor, bg: pins.includes(c.id) ? '#11141B' : 'transparent' };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8B919C' }}>Rotinas</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8B919C' }}>{CRONS_DATA.filter(c => !c.paused).length}/{CRONS_DATA.length} ativas</span>
      </span>
      <div style={{ display: 'flex', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#6E7480', paddingBottom: 4, borderBottom: '1px solid #1C212B' }}>
        <span style={{ width: 52, flex: 'none' }}>Hora</span><span style={{ flex: '1 1 auto' }}>Rotina</span><span>Estado</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {routines.map(r => (
          <li key={r.id}>
            <button onClick={() => onPick(r.id)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: r.bg, border: 0, borderBottom: '1px solid #12161E', padding: '7px 4px', color: '#E6E8EC', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, lineHeight: '16px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#C9CDD4', width: 48, flex: 'none' }}>{r.time}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ flex: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#8B919C', border: '1px solid #2A303C', borderRadius: 3, padding: '0 4px' }}>{r.owner}</span>
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 0.8, fontWeight: 600, color: r.stColor, whiteSpace: 'nowrap' }}>{r.st}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}