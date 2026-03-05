import type { Mode } from '../types';

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
  isTransitioning: boolean;
}

export default function ModeToggle({ mode, onChange, isTransitioning }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '100px',
      padding: '3px',
    }}>
      {(['graph', 'mirror', 'memory'] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => !isTransitioning && onChange(m)}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: '100px',
            border: 'none',
            cursor: isTransitioning ? 'wait' : 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            transition: 'all 0.25s ease',
            background: mode === m
              ? (m === 'graph' ? '#00ff94' : m === 'mirror' ? '#a855f7' : '#f59e0b')
              : 'transparent',
            color: mode === m ? '#050505' : 'rgba(255,255,255,0.45)',
            fontWeight: mode === m ? 600 : 400,
          }}
        >
          {m === 'graph' ? '⟡ Brain Scan' : m === 'mirror' ? '⟡ The Mirror' : '⟡ Memory'}
        </button>
      ))}
    </div>
  );
}
