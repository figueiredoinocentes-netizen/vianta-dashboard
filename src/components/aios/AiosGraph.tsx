import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AIOS_GRAPH, type GraphNode, type GraphEdge, NODE_COLORS, NODE_ICONS, NODE_SIZES } from '@/data/aios-graph-data';

interface AiosGraphProps {
  onNodeClick?: (node: GraphNode) => void;
  selectedNodeId?: string | null;
  width?: number;
  height?: number;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
  radius: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  data: GraphEdge;
}

/**
 * JaNIS Graph — grafo de força interativo do AI OS.
 * Renderizado em canvas para performance com muitos nós.
 */
const AiosGraph = ({ onNodeClick, selectedNodeId, width, height }: AiosGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: width || 900, h: height || 600 });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // Estado da simulação
  const simRef = useRef<{ nodes: SimNode[]; edges: SimEdge[] } | null>(null);
  const animRef = useRef<number>(0);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ node: SimNode | null; ox: number; oy: number }>({ node: null, ox: 0, oy: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });

  // Inicializar simulação
  useEffect(() => {
    const w = dimensions.w;
    const h = dimensions.h;

    // Criar nós da simulação
    const nodes: SimNode[] = AIOS_GRAPH.nodes.map((n, i) => {
      // Posições iniciais em círculo
      const angle = (i / AIOS_GRAPH.nodes.length) * Math.PI * 2;
      const radius = Math.min(w, h) * 0.3;
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        pinned: false,
        radius: NODE_SIZES[n.type] || 20,
      };
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Criar arestas da simulação
    const edges: SimEdge[] = AIOS_GRAPH.edges
      .map(e => ({
        source: nodeMap.get(e.source),
        target: nodeMap.get(e.target),
        data: e,
      }))
      .filter((e): e is SimEdge => !!e.source && !!e.target);

    simRef.current = { nodes, edges };
  }, [dimensions]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          setDimensions(prev => {
            if (Math.abs(prev.w - w) > 10 || Math.abs(prev.h - h) > 10) {
              return { w: Math.floor(w), h: Math.floor(h) };
            }
            return prev;
          });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Force simulation + render loop
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = dimensions.w;
    const H = dimensions.h;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const REPULSION = 6000;
    const ATTRACTION = 0.005;
    const DAMPING = 0.85;
    const CENTER_GRAVITY = 0.01;
    const MIN_DIST = 50;

    let running = true;

    const simulate = () => {
      if (!running) return;
      const { nodes, edges } = sim;

      // Repulsão entre nós
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.pinned && b.pinned) continue;

          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MIN_DIST) dist = MIN_DIST;

          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
          if (!b.pinned) { b.vx += fx; b.vy += fy; }
        }
      }

      // Atração (molas) nas arestas
      for (const edge of edges) {
        const a = edge.source;
        const b = edge.target;
        if (a.pinned && b.pinned) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const force = (dist - 150) * ATTRACTION;
        const fx = (dx / (dist || 1)) * force;
        const fy = (dy / (dist || 1)) * force;

        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      }

      // Gravidade para o centro
      const cx = W / 2;
      const cy = H / 2;

      // Conhecimento no centro, agentes à esquerda, skills/integrações à direita
      for (const node of nodes) {
        if (node.pinned) continue;

        // Center gravity
        node.vx += (cx - node.x) * CENTER_GRAVITY;
        node.vy += (cy - node.y) * CENTER_GRAVITY;

        // Group bias
        if (node.type === 'agent') node.vx -= 1.5; // left
        if (node.type === 'integration' || node.type === 'skill') node.vx += 1.5; // right
        if (node.type === 'knowledge') node.vy += 0.5; // bottom

        // Damping
        node.vx *= DAMPING;
        node.vy *= DAMPING;

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Keep in bounds
        node.x = Math.max(40, Math.min(W - 40, node.x));
        node.y = Math.max(40, Math.min(H - 40, node.y));
      }

      // Render
      render(ctx, W, H, nodes, edges);
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [dimensions]);

  const render = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    nodes: SimNode[],
    edges: SimEdge[]
  ) => {
    const t = transformRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    // ── Arestas ──
    for (const edge of edges) {
      const a = edge.source;
      const b = edge.target;
      const color = edge.data.color || 'rgba(100, 116, 139, 0.4)';

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = edge.data.dashed ? color : color;
      ctx.lineWidth = edge.data.dashed ? 1 : 1.5;
      ctx.setLineDash(edge.data.dashed ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label da aresta (a meio)
      if (edge.data.label) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.font = '8px sans-serif';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(edge.data.label, mx, my - 4);
      }
    }

    // ── Nós ──
    for (const node of nodes) {
      const color = NODE_COLORS[node.type] || '#64748b';
      const r = node.radius * (1 / t.scale);
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNode?.id;

      // Sombra
      ctx.shadowColor = isSelected ? `${color}80` : 'transparent';
      ctx.shadowBlur = isSelected ? 20 : 0;

      // Círculo base
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `${color}20`;
      ctx.fill();
      ctx.strokeStyle = isSelected ? color : `${color}60`;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Círculo interior (status)
      const innerR = r * 0.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, innerR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Se for conhecimento, desenhar anéis concêntricos
      if (node.type === 'knowledge') {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 0.75, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}30`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}20`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.font = `600 ${Math.max(9, 11 * t.scale)}px sans-serif`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + r + 14);

      // Descrição (no hover)
      if (isHovered && node.description) {
        ctx.font = '8px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(node.description, node.x, node.y + r + 26);
      }
    }

    ctx.restore();

    // Legenda (canto inferior direito)
    const legendY = H - 10;
    let lx = W - 10;
    const legendItems = Object.entries(NODE_COLORS);
    for (let i = legendItems.length - 1; i >= 0; i--) {
      const [type, color] = legendItems[i];
      const text = type.charAt(0).toUpperCase() + type.slice(1);
      ctx.font = '9px sans-serif';
      const tw = ctx.measureText(text).width;
      lx -= tw + 24;

      ctx.beginPath();
      ctx.arc(lx + 6, legendY - 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText(text, lx + 14, legendY);
    }
  };

  // Mouse handlers
  const getNodeAt = useCallback((clientX: number, clientY: number): SimNode | null => {
    const sim = simRef.current;
    if (!sim) return null;

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left - transformRef.current.x) / transformRef.current.scale;
    const my = (clientY - rect.top - transformRef.current.y) / transformRef.current.scale;

    // Reverse order (render top = last drawn)
    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const node = sim.nodes[i];
      const dx = mx - node.x;
      const dy = my - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < node.radius + 5) return node;
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node) {
      dragRef.current = { node, ox: node.x, oy: node.y };
      node.pinned = true;
      setDragging(node.id);
    }
  }, [getNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const sim = simRef.current;
    if (!sim) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale;
    const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale;

    mouseRef.current = { x: mx, y: my };

    if (dragging && dragRef.current.node) {
      dragRef.current.node.x = mx;
      dragRef.current.node.y = my;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
      return;
    }

    const node = getNodeAt(e.clientX, e.clientY);
    setHoveredNode(node || null);
    canvas.style.cursor = node ? 'pointer' : 'grab';
  }, [dragging, getNodeAt]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.node) {
      dragRef.current.node.pinned = false;
    }
    dragRef.current = { node: null, ox: 0, oy: 0 };
    setDragging(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.node) return; // foi um drag, não click
    const node = getNodeAt(e.clientX, e.clientY);
    if (node && onNodeClick) {
      onNodeClick(node);
    }
  }, [getNodeAt, onNodeClick]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const t = transformRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    t.scale = Math.max(0.3, Math.min(3, t.scale * delta));
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-border bg-card"
      style={{ minHeight: height || 500 }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ width: '100%', height: height || 500, touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Info do nó selecionado */}
      {selectedNodeId && (() => {
        const node = AIOS_GRAPH.nodes.find(n => n.id === selectedNodeId);
        if (!node) return null;
        return (
          <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{NODE_ICONS[node.type]}</span>
              <span>{node.label}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {node.type}
              </span>
            </div>
            {node.description && (
              <div className="mt-1 text-xs text-muted-foreground">{node.description}</div>
            )}
            {node.meta && (
              <div className="mt-0.5 text-[10px] text-muted-foreground/70">{node.meta}</div>
            )}
          </div>
        );
      })()}

      {/* Hint de interação */}
      <div className="absolute right-3 top-3 text-[10px] text-muted-foreground/50">
        Arrasta nós · Scroll para zoom · Clica para detalhes
      </div>
    </div>
  );
};

export default AiosGraph;
