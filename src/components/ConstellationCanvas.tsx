import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { ConstellationNode, ConstellationEdge, ConstellationData, Mode } from '../types';

interface Props {
  data: ConstellationData;
  mode: Mode;
  onNodeClick: (node: ConstellationNode | null) => void;
  selectedNode: ConstellationNode | null;
}

const CLUSTER_COLORS: Record<string, string> = {
  // Mirror mode
  builder:      '#00ff94',
  sovereign:    '#a855f7',
  seeker:       '#00d4ff',
  witness:      '#f59e0b',
  transmitter:  '#f43f5e',
  // Graph mode
  core:         '#00ff94',
  governance:   '#a855f7',
  infra:        '#3b82f6',
  ai:           '#00d4ff',
  tools:        '#f59e0b',
  concepts:     '#f43f5e',
  surface:      '#10b981',
};

const NODE_RADII: Record<string, number> = {
  archetype: 22,
  project:   14,
  concept:   16,
  tool:      12,
  moment:    7,
  person:    10,
};

export default function ConstellationCanvas({ data, onNodeClick, selectedNode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<d3.Simulation<ConstellationNode, ConstellationEdge> | null>(null);
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<ConstellationNode[]>([]);
  const edgesRef = useRef<ConstellationEdge[]>([]);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const hoveredNodeRef = useRef<ConstellationNode | null>(null);

  // Nebula phase for animation
  const nebulaPhaseRef = useRef(0);
  const pulsePhaseRef = useRef(0);

  const getNodeColor = (node: ConstellationNode): string => {
    return CLUSTER_COLORS[node.cluster] ?? '#888888';
  };

  const getNodeRadius = (node: ConstellationNode): number => {
    const base = NODE_RADII[node.type] ?? 8;
    return base * (0.6 + node.strength * 0.4);
  };

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    nebulaPhaseRef.current += 0.003;
    pulsePhaseRef.current += 0.02;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Dark void background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Nebula gradients
    const drawNebula = (cx: number, cy: number, r: number, color: string, alpha: number) => {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    };

    const phase = nebulaPhaseRef.current;
    drawNebula(
      W * 0.3 + Math.sin(phase * 0.7) * W * 0.1,
      H * 0.4 + Math.cos(phase * 0.5) * H * 0.1,
      W * 0.45,
      'rgb(0, 255, 148)',
      0.04
    );
    drawNebula(
      W * 0.7 + Math.cos(phase * 0.6) * W * 0.08,
      H * 0.3 + Math.sin(phase * 0.8) * H * 0.08,
      W * 0.35,
      'rgb(168, 85, 247)',
      0.05
    );
    drawNebula(
      W * 0.5 + Math.sin(phase * 0.4) * W * 0.05,
      H * 0.7 + Math.cos(phase * 0.9) * H * 0.06,
      W * 0.3,
      'rgb(0, 212, 255)',
      0.03
    );

    ctx.save();
    ctx.translate(transformRef.current.x, transformRef.current.y);
    ctx.scale(transformRef.current.k, transformRef.current.k);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    // Draw edges
    edges.forEach((edge) => {
      const s = edge.source as ConstellationNode;
      const t = edge.target as ConstellationNode;
      if (s.x == null || s.y == null || t.x == null || t.y == null) return;

      const alpha = edge.strength * 0.35;
      const sColor = getNodeColor(s);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);

      // Luminance wave on hover
      const isConnectedToHovered =
        hoveredNodeRef.current &&
        (s.id === hoveredNodeRef.current.id || t.id === hoveredNodeRef.current.id);
      const isConnectedToSelected =
        selectedNode &&
        (s.id === selectedNode.id || t.id === selectedNode.id);

      if (isConnectedToHovered || isConnectedToSelected) {
        const wavePhase = pulsePhaseRef.current + (s.x ?? 0) * 0.01;
        const waveAlpha = alpha + Math.sin(wavePhase) * 0.2;
        ctx.strokeStyle = sColor + Math.floor(Math.max(0, Math.min(1, waveAlpha)) * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1.5 / transformRef.current.k;
      } else {
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`;
        ctx.lineWidth = 0.8 / transformRef.current.k;
      }
      ctx.stroke();
    });

    // Draw nodes — fade in organically based on simulation alpha settling
    const simAlpha = simulationRef.current?.alpha() ?? 0;
    nodes.forEach((node) => {
      if (node.x == null || node.y == null) return;
      // Each node fades in with slight offset based on id hash
      const nodeAge = Math.max(0, 1 - simAlpha * 3);
      const idHash = node.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const fadeDelay = (idHash % 40) / 100; // 0 - 0.4 stagger
      const nodeOpacity = Math.min(1, Math.max(0, (nodeAge - fadeDelay) * 4));
      if (nodeOpacity <= 0) return;
      ctx.globalAlpha = nodeOpacity;
      const r = getNodeRadius(node);
      const color = getNodeColor(node);
      const isHovered = hoveredNodeRef.current?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const pulseOffset = (node.x ?? 0) * 0.1 + (node.y ?? 0) * 0.05;
      const pulse = Math.sin(pulsePhaseRef.current * 0.5 + pulseOffset) * 0.15 + 1;

      const displayR = r * (isHovered || isSelected ? 1.4 : pulse);

      // Glow — outer
      if (isHovered || isSelected || node.type === 'archetype' || node.type === 'concept') {
        const glowR = displayR * (isHovered || isSelected ? 3.5 : 2.5);
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        const glowAlpha = isHovered || isSelected ? 0.35 : 0.18;
        glow.addColorStop(0, color.replace('#', '').length === 6
          ? `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},${glowAlpha})`
          : color);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node body
      ctx.beginPath();
      ctx.arc(node.x, node.y, displayR, 0, Math.PI * 2);

      if (node.type === 'archetype') {
        // Archetype: filled with color
        ctx.fillStyle = color;
        ctx.fill();
        // Inner bright core
        const core = ctx.createRadialGradient(node.x - displayR * 0.25, node.y - displayR * 0.25, 0, node.x, node.y, displayR);
        core.addColorStop(0, 'rgba(255,255,255,0.6)');
        core.addColorStop(0.4, 'rgba(255,255,255,0.1)');
        core.addColorStop(1, 'transparent');
        ctx.fillStyle = core;
        ctx.fill();
      } else {
        // Moment/project/concept/tool: ring + subtle fill
        const fillAlpha = isHovered || isSelected ? 0.25 : node.strength * 0.15;
        ctx.fillStyle = color.replace('#', '').length === 6
          ? `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},${fillAlpha})`
          : color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = (isHovered || isSelected ? 2 : 1) / transformRef.current.k;
        ctx.stroke();
      }

      // Confidence ring (governance visual) — low confidence nodes show dashed ring
      if (node.confidence < 0.75) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, displayR + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,100,0.4)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1 / transformRef.current.k;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Label
      const labelSize = node.type === 'archetype' ? 13 : 10;
      const showLabel = isHovered || isSelected || node.type === 'archetype' ||
        (node.strength > 0.7 && transformRef.current.k > 0.6);

      if (showLabel) {
        ctx.font = `${labelSize / transformRef.current.k}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isHovered || isSelected ? '#ffffff' : 'rgba(255,255,255,0.75)';
        ctx.fillText(node.label, node.x, node.y + displayR + (14 / transformRef.current.k));
      }
    });

    ctx.globalAlpha = 1;
    ctx.restore();

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [selectedNode]);

  // Build simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Deep clone nodes/edges for simulation
    const nodes: ConstellationNode[] = data.nodes.map(n => ({ ...n }));
    const edges: ConstellationEdge[] = data.edges.map(e => ({ ...e }));

    nodesRef.current = nodes;
    edgesRef.current = edges;

    const W = canvas.width;
    const H = canvas.height;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    simulationRef.current = d3.forceSimulation<ConstellationNode>(nodes)
      .force('link', d3.forceLink<ConstellationNode, ConstellationEdge>(edges)
        .id(d => d.id)
        .distance(d => {
          const s = d.source as ConstellationNode;
          const t = d.target as ConstellationNode;
          const baseDistance = s.type === 'archetype' || t.type === 'archetype' ? 80 : 40;
          return baseDistance / (d.strength + 0.1);
        })
        .strength(d => d.strength * 0.4)
      )
      .force('charge', d3.forceManyBody<ConstellationNode>()
        .strength(d => {
          if (d.type === 'archetype') return -400;
          if (d.type === 'concept') return -200;
          return -80;
        })
      )
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<ConstellationNode>()
        .radius(d => getNodeRadius(d) * 1.5)
      )
      .alphaDecay(0.01)
      .velocityDecay(0.4);

    // Start render loop
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(drawFrame);

    return () => {
      simulationRef.current?.stop();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [data, drawFrame]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      // Re-center simulation
      simulationRef.current?.force('center', d3.forceCenter(canvas.offsetWidth / 2, canvas.offsetHeight / 2));
      simulationRef.current?.alpha(0.3).restart();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Zoom + pan via D3 zoom on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
      });

    d3.select(canvas).call(zoom);
    return () => { d3.select(canvas).on('.zoom', null); };
  }, []);

  // Hit detection for hover + click
  const getNodeAtPoint = useCallback((clientX: number, clientY: number): ConstellationNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
    const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

    let closest: ConstellationNode | null = null;
    let closestDist = Infinity;
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;
      const dist = Math.hypot(node.x - x, node.y - y);
      const hitR = getNodeRadius(node) * 1.8;
      if (dist < hitR && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    }
    return closest;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    hoveredNodeRef.current = getNodeAtPoint(e.clientX, e.clientY);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredNodeRef.current ? 'pointer' : 'default';
    }
  }, [getNodeAtPoint]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const node = getNodeAtPoint(e.clientX, e.clientY);
    onNodeClick(node);
  }, [getNodeAtPoint, onNodeClick]);

  // Touch support (pinch zoom handled by D3, tap = click)
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const node = getNodeAtPoint(t.clientX, t.clientY);
      onNodeClick(node);
    }
  }, [getNodeAtPoint, onNodeClick]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
    />
  );
}
