import { useEffect, useState } from 'react';
import type { ConstellationNode, Mode } from '../types';

interface Props {
  node: ConstellationNode | null;
  mode: Mode; // reserved for future mode-specific display
  onClose: () => void;
}

export default function DetailPanel({ node, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (node) {
      setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
    }
  }, [node]);

  if (!node) return null;

  const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
  const confidencePct = Math.round(node.confidence * 100);
  const confidenceColor = node.confidence >= 0.85 ? '#00ff94' : node.confidence >= 0.7 ? '#f59e0b' : '#f43f5e';

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: '300px',
      background: 'rgba(10,10,10,0.92)',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
      padding: '2rem 1.5rem',
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      overflowY: 'auto',
      zIndex: 10,
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '1.2rem',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >✕</button>

      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>{typeLabel} · {node.cluster}</span>
      </div>

      <h2 style={{
        fontSize: '1.2rem',
        fontFamily: 'Cormorant Garamond, serif',
        fontWeight: 600,
        color: '#fafafa',
        marginBottom: '1rem',
        lineHeight: 1.3,
      }}>{node.label}</h2>

      {node.description && (
        <p style={{
          fontSize: '0.85rem',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}>{node.description}</p>
      )}

      {/* Confidence gauge */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '0.4rem',
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <span>CONFIDENCE</span>
          <span style={{ color: confidenceColor }}>{confidencePct}%</span>
        </div>
        <div style={{
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${confidencePct}%`,
            background: confidenceColor,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Strength gauge */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '0.4rem',
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <span>SIGNAL STRENGTH</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{Math.round(node.strength * 100)}%</span>
        </div>
        <div style={{
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${node.strength * 100}%`,
            background: 'rgba(255,255,255,0.4)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {node.timestamp && (
        <div style={{
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.3)',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {new Date(node.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })}
        </div>
      )}

      {node.tags && node.tags.length > 0 && (
        <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {node.tags.map(tag => (
            <span key={tag} style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.6rem',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'JetBrains Mono, monospace',
            }}>{tag}</span>
          ))}
        </div>
      )}

      {/* Governance note for low-confidence nodes */}
      {node.confidence < 0.75 && (
        <div style={{
          marginTop: '1.5rem',
          padding: '0.75rem',
          background: 'rgba(255,255,100,0.06)',
          border: '1px solid rgba(255,255,100,0.2)',
          borderRadius: '6px',
          fontSize: '0.72rem',
          color: 'rgba(255,255,100,0.7)',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          ⚠ Below confidence threshold. Awaiting confirmation.
        </div>
      )}
    </div>
  );
}
