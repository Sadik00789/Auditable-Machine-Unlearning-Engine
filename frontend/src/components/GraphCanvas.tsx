'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Sparkles,
  Info,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { GraphNode, GraphLink } from '@/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onSelectEntity?: (entityId: string) => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  links,
  onSelectEntity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation State
  const nodesRef = useRef<GraphNode[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Hover & Active state
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize SISA Shard Hub Nodes and calculate positions
  useEffect(() => {
    // Sync external nodes prop into simulation nodesRef
    const currentMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    const updatedNodes: GraphNode[] = nodes.map((incomingNode) => {
      const existing = currentMap.get(incomingNode.id);
      if (existing) {
        return { ...existing, status: incomingNode.status };
      }

      // Initial position near its shard hub if entity
      let initialX = (Math.random() - 0.5) * 200;
      let initialY = (Math.random() - 0.5) * 200;

      if (incomingNode.type === 'shard') {
        // Arrange 4 shards in a circle
        const angle = (incomingNode.shardId / 4) * Math.PI * 2;
        initialX = Math.cos(angle) * 180;
        initialY = Math.sin(angle) * 180;
      }

      return {
        ...incomingNode,
        x: incomingNode.x || initialX,
        y: incomingNode.y || initialY,
        vx: 0,
        vy: 0,
        radius: incomingNode.type === 'shard' ? 22 : 12,
      };
    });

    // Detect purged nodes to emit explosion particles
    nodesRef.current.forEach((prevNode) => {
      const incoming = nodes.find((n) => n.id === prevNode.id);
      if (!incoming || incoming.status === 'purged') {
        // Spawn particle explosion at prevNode position
        spawnExplosion(prevNode.x, prevNode.y, '#F43F5E');
      }
    });

    nodesRef.current = updatedNodes;
  }, [nodes]);

  const spawnExplosion = (x: number, y: number, color: string) => {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        alpha: 1,
        color,
      });
    }
  };

  // Force simulation loop & Canvas render
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Force Simulation Step
      const simulationNodes = nodesRef.current;
      const shardHubs = simulationNodes.filter((n) => n.type === 'shard');

      simulationNodes.forEach((node) => {
        if (node.type === 'shard') {
          // Keep shard hubs fixed around center
          const targetAngle = (node.shardId / 4) * Math.PI * 2;
          const radius = Math.min(width, height) * 0.26;
          const targetX = Math.cos(targetAngle) * radius;
          const targetY = Math.sin(targetAngle) * radius;
          node.x += (targetX - node.x) * 0.1;
          node.y += (targetY - node.y) * 0.1;
        } else {
          // Entity nodes attracted to their SISA Shard hub
          const shardHub = shardHubs.find((s) => s.shardId === node.shardId);
          if (shardHub) {
            const dx = shardHub.x - node.x;
            const dy = shardHub.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const targetDist = 90;
            const force = (dist - targetDist) * 0.03;

            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }

          // Repulsion between entity nodes
          simulationNodes.forEach((other) => {
            if (node.id === other.id) return;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const distSq = dx * dx + dy * dy || 1;
            if (distSq < 10000) {
              const force = 120 / distSq;
              node.vx += (dx / Math.sqrt(distSq)) * force;
              node.vy += (dy / Math.sqrt(distSq)) * force;
            }
          });

          // Damping & friction
          node.vx *= 0.85;
          node.vy *= 0.85;
          node.x += node.vx;
          node.y += node.vy;
        }
      });

      // Update Particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;
        return p.alpha > 0;
      });

      // 2. Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // Render Canvas Background Grid Lines
      ctx.save();
      ctx.translate(centerX + transform.x, centerY + transform.y);
      ctx.scale(transform.scale, transform.scale);

      // 3. Draw Links (Shard Hub -> Entity Connections)
      simulationNodes.forEach((node) => {
        if (node.type === 'entity' && node.status !== 'purged') {
          const shardHub = shardHubs.find((s) => s.shardId === node.shardId);
          if (shardHub) {
            ctx.beginPath();
            ctx.moveTo(shardHub.x, shardHub.y);
            ctx.lineTo(node.x, node.y);
            ctx.strokeStyle = node.status === 'purging' ? 'rgba(244, 63, 94, 0.6)' : 'rgba(6, 182, 212, 0.25)';
            ctx.lineWidth = node.status === 'purging' ? 2 : 1.2;
            ctx.setLineDash(node.status === 'purging' ? [4, 4] : []);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      });

      // 4. Draw Particles (Disintegration explosion)
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 5. Draw Nodes
      simulationNodes.forEach((node) => {
        if (node.status === 'purged') return;

        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

        if (node.type === 'shard') {
          // SISA Shard Hub Node
          const glowGradient = ctx.createRadialGradient(node.x, node.y, 5, node.x, node.y, node.radius + 15);
          glowGradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
          glowGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 15, 0, Math.PI * 2);
          ctx.fill();

          // Outer Ring
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#111827';
          ctx.fill();
          ctx.strokeStyle = isHovered ? '#06B6D4' : '#8B5CF6';
          ctx.lineWidth = isHovered ? 3 : 2;
          ctx.stroke();

          // Icon / Text
          ctx.fillStyle = '#E2E8F0';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`SHARD ${node.shardId}`, node.x, node.y);
        } else {
          // Ingested Entity Node
          const isPurging = node.status === 'purging';
          const nodeColor = isPurging ? '#F43F5E' : '#10B981';

          // Node Glow
          const glowGradient = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, node.radius + 8);
          glowGradient.addColorStop(0, isPurging ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.3)');
          glowGradient.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.fill();

          // Inner Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fillStyle = isPurging ? '#450A0A' : '#064E3B';
          ctx.fill();
          ctx.strokeStyle = isHovered || isSelected ? '#FFFFFF' : nodeColor;
          ctx.lineWidth = isHovered ? 2.5 : 1.5;
          ctx.stroke();

          // Label
          ctx.fillStyle = '#94A3B8';
          ctx.font = '9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.label.slice(0, 10), node.x, node.y + node.radius + 12);
        }

        ctx.restore();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hoveredNode, selectedNode, transform]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse Interactions (Hover, Drag, Zoom)
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      }));
      return;
    }

    // Detect hovered node
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.width / 2 - transform.x;
    const mouseY = e.clientY - rect.top - canvas.height / 2 - transform.y;

    const hit = nodesRef.current.find((n) => {
      if (n.status === 'purged') return false;
      const dx = n.x - mouseX / transform.scale;
      const dy = n.y - mouseY / transform.scale;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    });

    setHoveredNode(hit || null);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
      if (hoveredNode.entityId && onSelectEntity) {
        onSelectEntity(hoveredNode.entityId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.4, Math.min(3, prev.scale * zoomFactor)),
    }));
  };

  const resetLayout = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setSelectedNode(null);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[440px] glass-panel rounded-xl border border-white/10 relative overflow-hidden flex flex-col select-none"
    >
      {/* Visual Canvas Toolbar Header */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/80 border border-white/10 backdrop-blur-md text-xs font-mono text-cyan-300 shadow-glass">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>SISA Shard Topology</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-surface/80 border border-white/10 p-1 rounded-lg backdrop-blur-md">
        <button
          onClick={() => setTransform((p) => ({ ...p, scale: Math.min(3, p.scale * 1.2) }))}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform((p) => ({ ...p, scale: Math.max(0.4, p.scale * 0.8) }))}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetLayout}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing bg-radial-vignette"
      />

      {/* Hover Node Tooltip Card */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 z-20 glass-panel p-3 rounded-lg border border-cyan-500/30 text-xs font-mono max-w-xs space-y-1 shadow-neon-cyan">
          <div className="flex items-center gap-2 text-cyan-300 font-bold">
            {hoveredNode.type === 'shard' ? (
              <Layers className="w-4 h-4 text-violet-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span>{hoveredNode.label}</span>
          </div>
          <div className="text-[11px] text-gray-400">
            Type: <span className="text-gray-200 uppercase">{hoveredNode.type}</span>
          </div>
          <div className="text-[11px] text-gray-400">
            SISA Shard: <span className="text-cyan-400">#Shard-{hoveredNode.shardId}</span>
          </div>
          {hoveredNode.entityId && (
            <div className="text-[11px] text-gray-400">
              Entity ID: <span className="text-emerald-400">{hoveredNode.entityId}</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Legend */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-surface/80 border border-white/10 text-[11px] font-mono text-gray-400 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 border border-violet-300" />
          <span>Shard Hub</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-300" />
          <span>Active Entity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-300" />
          <span>Purging</span>
        </div>
      </div>
    </div>
  );
};
