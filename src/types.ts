export type NodeType =
  | 'archetype'
  | 'moment'
  | 'project'
  | 'concept'
  | 'tool'
  | 'person'
  | 'pending'; // Awaiting Paul confirmation — new archetype or below confidence threshold

export type Mode = 'graph' | 'mirror' | 'memory';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
export type EnergyLevel = 'low' | 'medium' | 'high';

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
  isNew?: boolean;             // just added — triggers appearance animation
  provenance_hash?: string;   // governance: sha256 of text|archetype|ts|method
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
  energy: EnergyLevel;
  timeOfDay: TimeOfDay;
}

export interface CaptureResult {
  id: string;
  label: string;
  cluster: string;
  archetype: string;
  confidence: number;
  isNewArchetype: boolean;
  rawText: string;
  timestamp: number;
}
