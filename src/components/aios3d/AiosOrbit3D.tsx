import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  ALL_NODES, EDGES_DATA, CRONS_DATA, AREAS, AIDX, ACOL, ANAME,
  TYPE_NAME, SIZE, BYID, ADJ,
  type AiosNode, type NodeType, type AreaId
} from '@/data/aios-3d-data';

const HEX = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';
const DIA = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';

// Matrix operations
function mul(A: number[], B: number[]): number[] {
  const C = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return C;
}
function rotX(a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function rotY(a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotZ(a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function ortho(M: number[]): number[] {
  const nrm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const a = nrm([M[0], M[1], M[2]]);
  const d = a[0] * M[3] + a[1] * M[4] + a[2] * M[5];
  const b = nrm([M[3] - d * a[0], M[4] - d * a[1], M[5] - d * a[2]]);
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]];
}
const R0 = mul(rotX(-0.38), rotY(0.6));

// Shape function
function shapeOf(type: NodeType, color: string) {
  switch (type) {
    case 'hub': return { bg: '#F3F1EA', bd: '0', clip: HEX, r: '0' };
    case 'agent': return { bg: color, bd: '0', clip: HEX, r: '0' };
    case 'human': return { bg: 'transparent', bd: `2px solid ${color}`, clip: 'none', r: '50%' };
    case 'folder': return { bg: 'transparent', bd: `1.5px solid ${color}`, clip: 'none', r: '2px' };
    case 'skill': return { bg: color, bd: '0', clip: DIA, r: '0' };
    case 'cron': return { bg: 'transparent', bd: `2px solid ${color}`, clip: 'none', r: '50%' };
    case 'integ': return { bg: color, bd: '0', clip: 'none', r: '3px' };
    case 'app': return { bg: '#07090D', bd: `2.5px solid ${color}`, clip: 'none', r: '4px' };
    case 'data': return { bg: color, bd: '0', clip: 'none', r: '1px' };
    case 'script': return { bg: color, bd: '0', clip: 'none', r: '1px' };
    default: return { bg: color, bd: '0', clip: 'none', r: '50%' };
  }
}

// Layout constants
const W = 1000, H = 860, CX = 500, CY = 430, F = 1600;
const ZMIN = 0.4, ZMAX = 3;
const RF: Record<string, number> = { agent: 0.42, human: 0.7, folder: 1.05, file: 1.22, script: 1, data: 1.1, skill: 1, cron: 0.82, integ: 0.92, app: 0.78 };
const RING: Record<string, number> = { hub: 0, agent: 95, human: 95, cron: 175, integ: 175, app: 175, skill: 255, folder: 330, file: 330, script: 330, data: 330 };
const MAX_RING_R = 392;

interface OrbitProps {
  onNodeSelect?: (node: AiosNode | null) => void;
  selectedNodeId?: string | null;
  pinnedIds?: string[];
  areaFilter?: string;
  searchQuery?: string;
  showNames?: boolean;
  hiddenTypes?: Record<string, boolean>;
  motion?: boolean;
  viewMode?: 'orbit' | 'rings';
}

/**
 * AiosOrbit3D — Motor 3D da Órbita do AI OS
 * Renderizado com elementos posicionados em CSS, sem THREE.js
 */
const AiosOrbit3D = ({
  onNodeSelect, selectedNodeId, pinnedIds = [],
  areaFilter = 'all', searchQuery = '', showNames = true,
  hiddenTypes = {}, motion = true, viewMode = 'orbit',
}: OrbitProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(R0);
  const [ringRot, setRingRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dragState, setDragState] = useState<{ active: boolean; sx: number; sy: number; sR: number[] } | null>(null);
  const [hoveredId, setHovered] = useState<string | null>(null);
  const tickRef = useRef(0);

  // Compute 3D positions
  const ACENTER = AREAS.map((_, i) => {
    const y = 1 - ((i + 0.5) / AREAS.length) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.39996 + 0.6;
    return [Math.cos(th) * r * 230, y * 150, Math.sin(th) * r * 230] as number[];
  });

  // Initialize 3D positions
  const p3Map = new Map<string, [number, number, number]>();
  ALL_NODES.forEach((n, i) => {
    if (n.type === 'hub') { p3Map.set(n.id, [0, 0, 0]); return; }
    const c = ACENTER[AIDX[n.area] || 0];
    const f = RF[n.type] || 1;
    const j = n.type === 'agent' ? 0 : n.type === 'human' ? 30 : 72;
    const u = rnd(i, 1) * 2 - 1;
    const th = rnd(i, 2) * Math.PI * 2;
    const rr = Math.cbrt(rnd(i, 3)) * j;
    const sq = Math.sqrt(1 - u * u);
    const p3: [number, number, number] = [
      c[0] * f + rr * sq * Math.cos(th),
      c[1] * f + rr * u * 0.8,
      c[2] * f + rr * sq * Math.sin(th)
    ];
    if (n.id === 'jarvis') { p3[0] = c[0] * 0.28; p3[1] = c[1] * 0.28 - 20; p3[2] = c[2] * 0.28; }
    p3Map.set(n.id, p3);
  });

  // Initialize 2D positions (for rings view)
  const p2Map = new Map<string, [number, number]>();
  [95, 175, 255, 330].forEach(rad => {
    const list = ALL_NODES.filter(n => (RING[n.type] || 330) === rad)
      .sort((a, b) => (AIDX[a.area] || 0) - (AIDX[b.area] || 0));
    list.forEach((n, i) => {
      const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      p2Map.set(n.id, [Math.cos(a) * rad, Math.sin(a) * rad]);
    });
  });
  ALL_NODES.forEach(n => { if (!p2Map.has(n.id)) p2Map.set(n.id, [0, 0]); });

  // Area label positions (2D)
  const ALABEL2 = AREAS.map(a => {
    let sx = 0, sy = 0;
    ALL_NODES.forEach(n => {
      if (n.area === a[0] && n.type !== 'hub') {
        const p2 = p2Map.get(n.id)!;
        const l = Math.hypot(p2[0], p2[1]) || 1;
        sx += p2[0] / l; sy += p2[1] / l;
      }
    });
    const l = Math.hypot(sx, sy) || 1;
    return [sx / l * MAX_RING_R, sy / l * MAX_RING_R];
  });

  // Helper: deterministic random
  function rnd(i: number, k: number) {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Auto-rotation timer
  useEffect(() => {
    if (!motion) return;
    const timer = setInterval(() => {
      tickRef.current++;
      setRotation(prev => ortho(mul(rotY(0.0035), prev)));
      setRingRot(prev => prev + 0.0009);
    }, 50);
    return () => clearInterval(timer);
  }, [motion]);

  // Project 3D->2D
  const project = (p3: [number, number, number], p2: [number, number]) => {
    if (viewMode === 'rings') {
      const a = ringRot;
      const x = p2[0] * Math.cos(a) - p2[1] * Math.sin(a);
      const y = p2[0] * Math.sin(a) + p2[1] * Math.cos(a);
      return { x: CX + x * zoom, y: CY + y * zoom, s: zoom, near: 0.85 };
    }
    const R = rotation;
    const x1 = R[0] * p3[0] + R[1] * p3[1] + R[2] * p3[2];
    const y2 = R[3] * p3[0] + R[4] * p3[1] + R[5] * p3[2];
    const z2 = R[6] * p3[0] + R[7] * p3[1] + R[8] * p3[2];
    const s = (F / (F + z2)) * zoom;
    return { x: CX + x1 * s, y: CY + y2 * s, s, near: Math.max(0, Math.min(1, 1 - (z2 + 330) / 660)) };
  };

  // Filters
  const visible = ALL_NODES.filter(n => !hiddenTypes[TYPE_NAME[n.type] || '']);
  const visSet = new Set(visible.map(n => n.id));

  // Focus logic
  const focusSet = new Set<string>();
  if (hoveredId && BYID[hoveredId]) {
    focusSet.add(hoveredId);
    (ADJ[hoveredId] || []).forEach(x => focusSet.add(x));
  } else if (selectedNodeId && BYID[selectedNodeId]) {
    focusSet.add(selectedNodeId);
    (ADJ[selectedNodeId] || []).forEach(x => focusSet.add(x));
  }
  pinnedIds.forEach(pid => {
    if (BYID[pid]) {
      focusSet.add(pid);
      (ADJ[pid] || []).forEach(x => focusSet.add(x));
    }
  });

  const q = searchQuery.trim().toLowerCase();
  const hasFocus = focusSet.size > 0 || q.length > 0 || areaFilter !== 'all';

  const emphasis = (n: AiosNode): number => {
    if (hasFocus) {
      if (q) return n.label.toLowerCase().indexOf(q) >= 0 ? 1 : 0.12;
      if (focusSet.has(n.id)) return 1;
      return 0.08;
    }
    if (areaFilter !== 'all') return n.area === areaFilter || n.type === 'hub' ? 1 : 0.07;
    return 1;
  };

  // Build nodes
  const nodeEls: any[] = [];
  const edgeEls: any[] = [];
  const labelEls: any[] = [];
  const ringEls: any[] = [];

  visible.forEach(n => {
    const p3 = p3Map.get(n.id) || [0, 0, 0];
    const p2 = p2Map.get(n.id) || [0, 0];
    const p = project(p3, p2);
    const color = ACOL[n.area] || '#8B919C';
    const sh = shapeOf(n.type, color);
    const size = (SIZE[n.type] || 10) * p.s;
    const hit = Math.max(size, 18);
    const e = emphasis(n);
    const base = 0.4 + 0.6 * p.near;
    const op = e === 1 ? base : e * base;

    // Ring circles (orbit view)
    if (n.type === 'hub') {
      [95, 175, 255, 330].forEach(r => {
        const rs = r * zoom;
        ringEls.push({ l: 0, t: 0, w: rs * 2, h: rs * 2, a: 0, style: 'solid' });
      });
    }

    // Node button
    nodeEls.push({
      id: n.id,
      l: (p.x / W) * 100,
      t: (p.y / H) * 100,
      hw: (hit / W) * 100,
      iw: (size / hit) * 100,
      bg: sh.bg,
      bd: sh.bd,
      r: sh.r,
      clip: sh.clip,
      op,
      z: Math.round(p.near * 100) + (focusSet.has(n.id) ? 200 : 0) + (n.type === 'hub' || n.type === 'agent' ? 50 : 0),
      ol: (selectedNodeId === n.id || pinnedIds.indexOf(n.id) >= 0) ? '1.5px solid #E6E8EC' : 'none',
      aria: `${TYPE_NAME[n.type] || ''}: ${n.label}`,
    });

    // Label
    if (showNames && e > 0.2) {
      const fs = Math.max(8, Math.min(11, 11 * p.s));
      const ls = p.s > 0.7 ? 1 : 0;
      labelEls.push({
        l: (p.x / W) * 100,
        t: (p.y / H) * 100 + 1.5,
        text: n.label,
        fs, ls, c: '#E6E8EC', op: Math.min(1, op * 1.5),
      });
    }

    // Edges
    EDGES_DATA.forEach(e => {
      if (e.source !== n.id && e.target !== n.id) return;
      const otherId = e.source === n.id ? e.target : e.source;
      if (!visSet.has(otherId)) return;
      const other = visible.find(v => v.id === otherId);
      if (!other) return;
      const p3b = p3Map.get(otherId) || [0, 0, 0];
      const p2b = p2Map.get(otherId) || [0, 0];
      const b = project(p3b, p2b);
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      let c = 'rgba(230,232,236,1)';
      let opEdge = 0.06 + 0.1 * ((p.near + b.near) / 2);
      if (hasFocus) {
        const hA = focusSet.has(e.source);
        const hB = focusSet.has(e.target);
        if (hA || hB) { c = ACOL[BYID[hA ? e.source : e.target]?.area || 'sistema'] || c; opEdge = 0.85; }
        else opEdge = 0.02;
      } else if (areaFilter !== 'all') {
        const na = BYID[e.source];
        const nb = BYID[e.target];
        if (na?.area === areaFilter && nb?.area === areaFilter) { c = ACOL[areaFilter] || c; opEdge = 0.5; }
        else opEdge = 0.04;
      }
      if (len > 1 && opEdge > 0.01 && p.x > 0 && p.y > 0 && b.x > 0 && b.y > 0) {
        // Only add edge once (from the source node)
        if (e.source === n.id) {
          edgeEls.push({
            l: (p.x / W) * 100,
            t: (p.y / H) * 100,
            w: (len / W) * 100,
            h: 0.5,
            c,
            op: opEdge,
            a: angle,
          });
        }
      }
    });
  });

  return {
    nodeEls, edgeEls, labelEls, ringEls,
    setRotation: (R: number[]) => setRotation(R),
    getRotation: () => rotation,
    setHovered: (id: string | null) => setHovered(id),
    getZoom: () => zoom,
    setZoom: (z: number) => setZoom(Math.max(ZMIN, Math.min(ZMAX, z))),
    zoomBy: (dz: number) => setZoom(z => Math.max(ZMIN, Math.min(ZMAX, z * dz))),
  };
};

export default AiosOrbit3D;