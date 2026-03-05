import { useEffect, useState } from 'react';
import type { ConstellationNode, Mode } from '../types';
import { confirmArchetype } from '../api/patternEngine';

interface Props {
  node: ConstellationNode | null;
  mode: Mode;
  onClose: () => void;
  onConfirm?: (nodeId: string) => void;
}

export default function DetailPanel({ node, onClose, onConfirm }: Props) {
  const [visible, setVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (node) {
      setTimeout(() => setVisible(true), 10);
      setConfirmed(false);
    } else {
      setVisible(false);
    }
  }, [node]);

  const handleConfirm = async () => {
    if (!node || confirming) return;
    setConfirming(true);
    const ok = await confirmArchetype(node.id);
    if (ok) {
      setConfirmed(true);
      onConfirm?.(node.id);
    }
    setConfirming(false);
  };

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

      {/* Pending node — confirmation flow */}
      {node.type === 'pending' && !confirmed && (
        <div style={{
          marginTop: '1.5rem',
          padding: '0.75rem',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'JetBrains Mono, monospace', marginBottom: '0.75rem' }}>
            ○ pending confirmation — confidence {Math.round(node.confidence * 100)}%
          </div>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              width: '100%', padding: '0.5rem', background: 'transparent',
              border: '1px solid rgba(0,255,148,0.3)', borderRadius: '4px',
              color: 'rgba(0,255,148,0.8)', fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem', cursor: confirming ? 'wait' : 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            {confirming ? 'confirming…' : '⟡ confirm this pattern'}
          </button>
        </div>
      )}

      {confirmed && (
        <div style={{
          marginTop: '1.5rem', padding: '0.75rem',
          background: 'rgba(0,255,148,0.06)',
          border: '1px solid rgba(0,255,148,0.2)',
          borderRadius: '6px', fontSize: '0.72rem',
          color: 'rgba(0,255,148,0.7)', fontFamily: 'JetBrains Mono, monospace',
        }}>
          ⟡ confirmed — pattern integrated
        </div>
      )}

      {/* Governance note for low-confidence (non-pending) */}
      {node.confidence < 0.75 && node.type !== 'pending' && (
        <div style={{
          marginTop: '1.5rem', padding: '0.75rem',
          background: 'rgba(255,255,100,0.06)',
          border: '1px solid rgba(255,255,100,0.2)',
          borderRadius: '6px', fontSize: '0.72rem',
          color: 'rgba(255,255,100,0.7)', fontFamily: 'JetBrains Mono, monospace',
        }}>
          ⚠ below confidence threshold
        </div>
      )}

      {/* Provenance hash */}
      {(node as ConstellationNode & { provenance_hash?: string }).provenance_hash && (
        <div style={{
          marginTop: '1rem', fontSize: '0.62rem',
          color: 'rgba(255,255,255,0.18)', fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.04em', wordBreak: 'break-all',
        }}>
          provenance: {(node as ConstellationNode & { provenance_hash?: string }).provenance_hash}
        </div>
      )}
    </div>
  );
}
