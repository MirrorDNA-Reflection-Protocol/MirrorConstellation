import type { CaptureResult, ConstellationNode } from '../types';

const PATTERN_ENGINE_URL = 'http://localhost:8203';

export async function submitCapture(text: string): Promise<CaptureResult | null> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, timestamp: Date.now() }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getArchetypes(): Promise<ConstellationNode[]> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/archetypes`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function confirmArchetype(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function isEngineOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/status`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchQuarantine(): Promise<{ nodes: unknown[] } | null> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/api/constellation/quarantine`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchGraphData(): Promise<{ nodes: unknown[]; edges: unknown[] } | null> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/api/constellation/graph`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchMirrorData(): Promise<{ nodes: unknown[]; edges: unknown[] } | null> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/api/constellation/mirror`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchRhythm(): Promise<{ energy: string; physics_modifier: number } | null> {
  try {
    const res = await fetch(`${PATTERN_ENGINE_URL}/api/constellation/rhythm`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function createConstellationWebSocket(onNode: (node: unknown) => void): WebSocket | null {
  try {
    const ws = new WebSocket(`ws://localhost:8203/ws/constellation`);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'new_node') onNode(data.node);
      } catch { /* ignore */ }
    };
    ws.onopen = () => {
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        else clearInterval(ping);
      }, 30000);
    };
    return ws;
  } catch {
    return null;
  }
}
