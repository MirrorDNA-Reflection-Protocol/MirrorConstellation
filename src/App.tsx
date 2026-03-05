import { useState, useCallback, useRef, useEffect } from 'react';
import type { ConstellationNode, ConstellationData, CaptureResult, Mode } from './types';
import { mirrorData, graphData } from './data/mockData';
import ConstellationCanvas from './components/ConstellationCanvas';
import DetailPanel from './components/DetailPanel';
import ModeToggle from './components/ModeToggle';
import ScreenshotButton from './components/ScreenshotButton';
import AdaptivePresence from './components/AdaptivePresence';
import CaptureInput from './components/CaptureInput';
import { useTimeOfDay } from './hooks/useTimeOfDay';
import {
  isEngineOnline, fetchGraphData, fetchMirrorData, fetchRhythm,
  fetchQuarantine, createConstellationWebSocket
} from './api/patternEngine';

const LS_KEY_MIRROR = 'mc-last-mirror';
const LS_KEY_GRAPH  = 'mc-last-graph';

function saveToCache(key: string, data: ConstellationData) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

function loadFromCache(key: string): ConstellationData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function App() {
  const [mode, setMode] = useState<Mode>('mirror');
  const [selectedNode, setSelectedNode] = useState<ConstellationNode | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [liveData, setLiveData] = useState<ConstellationData>(mirrorData);
  const [engineOnline, setEngineOnline] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'cached' | 'mock'>('mock');
  const [showQuarantine, setShowQuarantine] = useState(false);
  const [quarantineNodes, setQuarantineNodes] = useState<ConstellationNode[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timeCtx = useTimeOfDay();
  const [physicsModifier, setPhysicsModifier] = useState(1.0);

  const dominantArchetype = liveData.nodes
    .filter(n => n.type === 'archetype')
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0]?.cluster ?? 'builder';

  const loadLiveData = useCallback(async (currentMode: Mode) => {
    if (currentMode === 'memory') return; // memory-graph handles its own data fetch
    const online = await isEngineOnline();
    setEngineOnline(online);

    if (!online) {
      // Last-known-state: prefer cache over mock
      const cached = loadFromCache(currentMode === 'mirror' ? LS_KEY_MIRROR : LS_KEY_GRAPH);
      if (cached) {
        setLiveData(cached);
        setDataSource('cached');
      } else {
        setLiveData(currentMode === 'mirror' ? mirrorData : graphData);
        setDataSource('mock');
      }
      return;
    }

    const [data, rhythm] = await Promise.all([
      currentMode === 'mirror' ? fetchMirrorData() : fetchGraphData(),
      fetchRhythm(),
    ]);

    if (data && (data.nodes as unknown[]).length > 0) {
      let finalData: ConstellationData;
      if (currentMode === 'mirror') {
        const liveNodes = data.nodes as ConstellationNode[];
        const mockMoments = mirrorData.nodes.filter(n => n.type === 'moment');
        const liveEdges = data.edges as ConstellationData['edges'];
        const mockEdges = mirrorData.edges.filter(e => {
          const src = typeof e.source === 'string' ? e.source : (e.source as ConstellationNode).id;
          return !liveNodes.find(n => n.id === src);
        });
        finalData = { nodes: [...liveNodes, ...mockMoments], edges: [...liveEdges, ...mockEdges] };
      } else {
        finalData = data as ConstellationData;
      }
      setLiveData(finalData);
      setDataSource('live');
      saveToCache(currentMode === 'mirror' ? LS_KEY_MIRROR : LS_KEY_GRAPH, finalData);
    } else {
      const cached = loadFromCache(currentMode === 'mirror' ? LS_KEY_MIRROR : LS_KEY_GRAPH);
      if (cached) { setLiveData(cached); setDataSource('cached'); }
      else { setLiveData(currentMode === 'mirror' ? mirrorData : graphData); setDataSource('mock'); }
    }

    if (rhythm) setPhysicsModifier((rhythm as { physics_modifier: number }).physics_modifier);
    setCanvasKey(k => k + 1);
  }, []);

  // Load quarantine nodes
  const loadQuarantine = useCallback(async () => {
    const q = await fetchQuarantine();
    if (q) setQuarantineNodes(q.nodes as ConstellationNode[]);
  }, []);

  useEffect(() => {
    loadLiveData(mode);
    loadQuarantine();
    const interval = setInterval(() => isEngineOnline().then(setEngineOnline), 30000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket
  useEffect(() => {
    if (!engineOnline) return;
    wsRef.current?.close();
    wsRef.current = createConstellationWebSocket((nodeData) => {
      const nr = nodeData as CaptureResult;
      const node: ConstellationNode = {
        id: nr.id, label: nr.label,
        type: nr.confidence < 0.6 ? 'pending' : 'moment',
        confidence: nr.confidence, strength: nr.confidence * 0.5,
        cluster: nr.cluster, description: nr.rawText,
        timestamp: nr.timestamp, isNew: true,
        provenance_hash: (nr as CaptureResult & { provenance_hash?: string }).provenance_hash,
      };
      setLiveData(prev => ({ nodes: [...prev.nodes, node], edges: prev.edges }));
      if (node.type === 'pending') setQuarantineNodes(prev => [...prev, node]);
      setCanvasKey(k => k + 1);
    });
    return () => wsRef.current?.close();
  }, [engineOnline]);

  const handleModeChange = useCallback((newMode: Mode) => {
    if (newMode === mode) return;
    setIsTransitioning(true);
    setSelectedNode(null);
    setTimeout(() => {
      setMode(newMode);
      loadLiveData(newMode);
      setIsTransitioning(false);
    }, 350);
  }, [mode, loadLiveData]);

  const handleNodeClick = useCallback((node: ConstellationNode | null) => {
    setSelectedNode(prev => (prev?.id === node?.id ? null : node));
  }, []);

  const handleCapture = useCallback((result: CaptureResult) => {
    if (mode !== 'mirror') return;
    const newNode: ConstellationNode = {
      id: result.id, label: result.label,
      type: result.confidence < 0.6 || result.isNewArchetype ? 'pending' : 'moment',
      confidence: result.confidence, strength: result.confidence * 0.5,
      cluster: result.cluster === 'pending' ? dominantArchetype : result.cluster,
      description: result.rawText, timestamp: result.timestamp, isNew: true,
    };
    const archetypeNode = liveData.nodes.find(n => n.type === 'archetype' && n.cluster === newNode.cluster);
    setLiveData(prev => ({
      nodes: [...prev.nodes, newNode],
      edges: archetypeNode
        ? [...prev.edges, { source: archetypeNode.id, target: newNode.id, strength: result.confidence * 0.4 }]
        : prev.edges,
    }));
    if (newNode.type === 'pending') setQuarantineNodes(prev => [...prev, newNode]);
    setCanvasKey(k => k + 1);
  }, [mode, liveData, dominantArchetype]);

  const handleConfirm = useCallback((nodeId: string) => {
    // Upgrade pending → moment in live data
    setLiveData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, type: 'moment' as const } : n),
    }));
    setQuarantineNodes(prev => prev.filter(n => n.id !== nodeId));
    setCanvasKey(k => k + 1);
  }, []);

  // Displayed data: base + quarantine if toggled
  const displayData: ConstellationData = showQuarantine
    ? { nodes: [...liveData.nodes, ...quarantineNodes.filter(q => !liveData.nodes.find(n => n.id === q.id))], edges: liveData.edges }
    : liveData;

  const sourceLabel = dataSource === 'live' ? '· live' : dataSource === 'cached' ? '· cached' : '';
  const sourceColor = dataSource === 'live' ? 'rgba(0,255,148,0.4)' : 'rgba(255,200,100,0.4)';

  return (
    <div ref={rootRef} style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#050505', position: 'relative',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Memory mode — full-screen iframe */}
      {mode === 'memory' && (
        <iframe
          src="http://localhost:8203/memory-graph"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', zIndex: 1 }}
          title="Memory Graph"
        />
      )}

      <div style={{ position: 'absolute', inset: 0, opacity: isTransitioning || mode === 'memory' ? 0 : 1, transition: 'opacity 0.35s ease', pointerEvents: mode === 'memory' ? 'none' : 'auto' }}>
        <ConstellationCanvas
          key={canvasKey}
          data={displayData}
          mode={mode}
          onNodeClick={handleNodeClick}
          selectedNode={selectedNode}
          breathSpeed={timeCtx.breathSpeed * physicsModifier}
        />
      </div>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', zIndex: 5,
        background: 'linear-gradient(to bottom, rgba(5,5,5,0.7) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em' }}>
            ⟡ MirrorConstellation
          </span>
        </div>
        <div style={{ pointerEvents: 'auto' }}>
          <ModeToggle mode={mode} onChange={handleModeChange} isTransitioning={isTransitioning} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', pointerEvents: 'auto' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
            {displayData.nodes.length} nodes · {displayData.edges.length} edges
            {sourceLabel && <span style={{ color: sourceColor, marginLeft: '0.5rem' }}>{sourceLabel}</span>}
          </span>
          {/* Quarantine toggle — Mirror mode only */}
          {mode === 'mirror' && quarantineNodes.length > 0 && (
            <button
              onClick={() => setShowQuarantine(q => !q)}
              style={{
                background: 'transparent',
                border: `1px solid ${showQuarantine ? 'rgba(255,200,100,0.5)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '4px', color: showQuarantine ? 'rgba(255,200,100,0.8)' : 'rgba(255,255,255,0.3)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
                letterSpacing: '0.06em', padding: '0.25rem 0.5rem', cursor: 'pointer',
              }}
            >
              {showQuarantine ? '◉' : '○'} {quarantineNodes.length} pending
            </button>
          )}
          <ScreenshotButton targetRef={rootRef} />
        </div>
      </div>

      <AdaptivePresence timeCtx={timeCtx} mode={mode} dominantArchetype={dominantArchetype} />
      {mode === 'mirror' && <CaptureInput onCapture={handleCapture} engineOnline={engineOnline} />}

      {/* Bottom */}
      <div style={{
        position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.08em', textAlign: 'center', zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        scroll to zoom · drag to pan · tap a node
        <br /><span style={{ color: 'rgba(255,255,255,0.1)' }}>⟡ MirrorDNA — constellation.activemirror.ai</span>
      </div>

      <div style={{
        position: 'absolute', bottom: '1.5rem', right: '1.5rem',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
        color: engineOnline ? 'rgba(0,255,148,0.35)' : 'rgba(255,100,100,0.25)',
        zIndex: 5, pointerEvents: 'none',
      }}>
        {engineOnline ? 'governed · local-first' : dataSource === 'cached' ? 'governed · last known state' : 'governed · engine offline'}
      </div>

      <DetailPanel node={selectedNode} mode={mode} onClose={() => setSelectedNode(null)} onConfirm={handleConfirm} />
    </div>
  );
}
