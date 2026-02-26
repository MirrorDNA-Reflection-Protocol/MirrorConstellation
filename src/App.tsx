import { useState, useCallback, useRef } from 'react';
import type { ConstellationNode, Mode } from './types';
import { mirrorData, graphData } from './data/mockData';
import ConstellationCanvas from './components/ConstellationCanvas';
import DetailPanel from './components/DetailPanel';
import ModeToggle from './components/ModeToggle';
import ScreenshotButton from './components/ScreenshotButton';

export default function App() {
  const [mode, setMode] = useState<Mode>('mirror');
  const [selectedNode, setSelectedNode] = useState<ConstellationNode | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleModeChange = useCallback((newMode: Mode) => {
    if (newMode === mode) return;
    setIsTransitioning(true);
    setSelectedNode(null);
    setTimeout(() => {
      setMode(newMode);
      setCanvasKey(k => k + 1);
      setIsTransitioning(false);
    }, 350);
  }, [mode]);

  const handleNodeClick = useCallback((node: ConstellationNode | null) => {
    setSelectedNode(prev => (prev?.id === node?.id ? null : node));
  }, []);

  const data = mode === 'mirror' ? mirrorData : graphData;

  return (
    <div ref={rootRef} style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#050505',
      position: 'relative',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Canvas — full screen */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: isTransitioning ? 0 : 1,
        transition: 'opacity 0.35s ease',
      }}>
        <ConstellationCanvas
          key={canvasKey}
          data={data}
          mode={mode}
          onNodeClick={handleNodeClick}
          selectedNode={selectedNode}
        />
      </div>

      {/* Top bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 5,
        background: 'linear-gradient(to bottom, rgba(5,5,5,0.7) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <span style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.04em',
          }}>⟡ MirrorConstellation</span>
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <ModeToggle mode={mode} onChange={handleModeChange} isTransitioning={isTransitioning} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', pointerEvents: 'auto' }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.25)',
          }}>
            {data.nodes.length} nodes · {data.edges.length} edges
          </span>
          <ScreenshotButton targetRef={rootRef} />
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{
        position: 'absolute',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.65rem',
        color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.08em',
        textAlign: 'center',
        zIndex: 5,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        scroll to zoom · drag to pan · tap a node
        <br />
        <span style={{ color: 'rgba(255,255,255,0.1)' }}>⟡ MirrorDNA — constellation.activemirror.ai</span>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '1.5rem',
        right: '1.5rem',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.65rem',
        color: 'rgba(0,255,148,0.35)',
        zIndex: 5,
        pointerEvents: 'none',
      }}>
        governed · local-first
      </div>

      <DetailPanel
        node={selectedNode}
        mode={mode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
