import { useState, useRef, useEffect } from 'react';
import type { CaptureResult } from '../types';
import { submitCapture } from '../api/patternEngine';

interface Props {
  onCapture: (result: CaptureResult) => void;
  engineOnline: boolean;
}

export default function CaptureInput({ onCapture, engineOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setLastResult(null);

    const result = await submitCapture(text.trim());
    if (result) {
      onCapture(result);
      setLastResult(`→ ${result.archetype} (${Math.round(result.confidence * 100)}%)`);
    } else {
      // Engine offline — create a local pending node
      const fallback: CaptureResult = {
        id: `capture-${Date.now()}`,
        label: text.trim().slice(0, 40),
        cluster: 'pending',
        archetype: 'unknown',
        confidence: 0,
        isNewArchetype: false,
        rawText: text.trim(),
        timestamp: Date.now(),
      };
      onCapture(fallback);
      setLastResult('→ queued (engine offline)');
    }

    setText('');
    setSubmitting(false);
    setTimeout(() => setLastResult(null), 4000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setText('');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '1.5rem',
      left: '1.5rem',
      zIndex: 10,
    }}>
      {/* Expanded input */}
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '2.2rem',
          left: 0,
          width: '280px',
          background: 'rgba(5,5,8,0.92)',
          border: '1px solid rgba(0,255,148,0.15)',
          borderRadius: '6px',
          padding: '0.75rem',
          backdropFilter: 'blur(8px)',
        }}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="capture a moment..."
            rows={3}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
              lineHeight: 1.6,
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.4rem',
          }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.55rem',
              color: lastResult
                ? 'rgba(0,255,148,0.6)'
                : engineOnline
                  ? 'rgba(0,255,148,0.35)'
                  : 'rgba(255,100,100,0.4)',
              letterSpacing: '0.06em',
            }}>
              {lastResult || (engineOnline ? '⟡ engine online' : '⊘ engine offline — queued locally')}
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.55rem',
              color: 'rgba(255,255,255,0.2)',
            }}>
              ↵ capture · esc close
            </span>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent',
          border: '1px solid rgba(0,255,148,0.2)',
          borderRadius: '4px',
          color: 'rgba(0,255,148,0.5)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.65rem',
          letterSpacing: '0.08em',
          padding: '0.35rem 0.65rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(0,255,148,0.5)';
          (e.target as HTMLButtonElement).style.color = 'rgba(0,255,148,0.9)';
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(0,255,148,0.2)';
          (e.target as HTMLButtonElement).style.color = 'rgba(0,255,148,0.5)';
        }}
      >
        {open ? '× close' : '+ capture'}
      </button>
    </div>
  );
}
