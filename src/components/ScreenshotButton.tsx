import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
}

export default function ScreenshotButton({ targetRef }: Props) {
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async () => {
    if (!targetRef.current || capturing) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#050505',
        scale: 2,
        logging: false,
      });

      // Add watermark
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '24px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'right';
        ctx.fillText('⟡ MirrorDNA', canvas.width - 24, canvas.height - 20);
      }

      const link = document.createElement('a');
      link.download = `mirrorconstellation-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setCapturing(false);
    }
  }, [targetRef, capturing]);

  return (
    <button
      onClick={capture}
      disabled={capturing}
      title="Capture constellation"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: capturing ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.7rem',
        padding: '0.4rem 0.8rem',
        cursor: capturing ? 'wait' : 'pointer',
        letterSpacing: '0.05em',
        transition: 'all 0.2s',
      }}
    >
      {capturing ? 'capturing...' : '⟡ capture'}
    </button>
  );
}
