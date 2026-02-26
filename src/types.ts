export type NodeType =
  | 'archetype'
  | 'moment'
  | 'project'
  | 'concept'
  | 'tool'
  | 'person';

export type Mode = 'graph' | 'mirror';

export interface ConstellationNode {
  id: string;
  label: string;
  type: NodeType;
  confidence: number; // 0-1, governance field — always present
  strength: number;   // 0-1, visual size
  cluster: string;
  description?: string;
  timestamp?: number;
  tags?: string[];
  // D3 simulation fields
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface ConstellationEdge {
  source: string | ConstellationNode;
  target: string | ConstellationNode;
  strength: number; // 0-1
}

export interface ConstellationData {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
}

export interface PresenceState {
  text: string;
  archetype: string;
  energy: 'low' | 'medium' | 'high';
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
}
