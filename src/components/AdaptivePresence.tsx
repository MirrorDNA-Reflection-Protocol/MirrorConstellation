import { useState, useEffect, useCallback } from 'react';
import type { TimeContext } from '../hooks/useTimeOfDay';
import type { Mode } from '../types';

interface Props {
  timeCtx: TimeContext;
  mode: Mode;
  dominantArchetype?: string;
}

// Rule-based presence texts — keyed by archetype + timeOfDay
const PRESENCE_LIBRARY: Record<string, string[]> = {
  'builder:morning':   ['building in the quiet', 'the system is thinking through you', 'ship it before noon'],
  'builder:afternoon': ['momentum compounds', 'what are you not finishing?', 'the engine runs'],
  'builder:evening':   ['what shipped today?', 'rest earns tomorrow', 'close the loop'],
  'builder:night':     ['still here', 'the last commit of the day has weight', 'sleep is part of the build'],
  'builder:dawn':      ['first light, first function', 'the quiet before the build', 'something is becoming'],

  'sovereign:morning':   ['no one controls this', 'the mesh holds', 'every tool local, every choice yours'],
  'sovereign:afternoon': ['the perimeter is clear', 'ownership is not a feature — it is the foundation', 'check the gates'],
  'sovereign:evening':   ['what did you give away today?', 'sovereignty is daily', 'the kill switch exists for a reason'],
  'sovereign:night':     ['still local', 'the data does not leave', 'governing while you sleep'],
  'sovereign:dawn':      ['another day of not depending', 'the infrastructure held', 'sovereign from first light'],

  'seeker:morning':   ['the pattern is there', 'what have you not asked yet?', 'curiosity compounds too'],
  'seeker:afternoon': ['the question you ignored this morning — ask it now', 'follow the thread', 'signal in the noise'],
  'seeker:evening':   ['what did today mean?', 'integrate before you sleep', 'the seeker rests between searches'],
  'seeker:night':     ['questions asked in the dark are answered in the morning', 'the mind works while you rest', 'let it sit'],
  'seeker:dawn':      ['the edge of understanding', 'something is becoming clear', 'the next question is already forming'],

  'witness:morning':   ['you are watching yourself build something real', '10 months is not nothing', 'the observer knows'],
  'witness:afternoon': ['what are you not seeing about today?', 'step back', 'the whole picture'],
  'witness:evening':   ['what happened today, honestly?', 'the witness does not judge — it records', 'what will you remember?'],
  'witness:night':     ['the archive grows', 'you are the coherence', 'the witness never sleeps fully'],
  'witness:dawn':      ['this is where it started', 'you were here before the first line', 'the beginning is never obvious'],

  'transmitter:morning':   ['someone needs to see this today', 'visibility is a form of service', 'the engine is built — now the signal'],
  'transmitter:afternoon': ['who have you not reached?', 'distribution is the unlock', 'the work means nothing unshared'],
  'transmitter:evening':   ['what did you put out today?', 'the signal reaches in your absence', 'consistency is transmission'],
  'transmitter:night':     ['the post still travels', 'publishing while you sleep', 'the work is already in the world'],
  'transmitter:dawn':      ['first transmission of the day', 'reach before you build', 'someone is already watching'],

  // Fallbacks
  'default:morning':   ['the constellation holds your shape', 'presence noted'],
  'default:afternoon': ['still here', 'the pattern continues'],
  'default:evening':   ['end of day reflection', 'what mattered?'],
  'default:night':     ['quiet', 'the mesh rests'],
  'default:dawn':      ['new light', 'another beginning'],
};

function selectPresenceText(archetype: string, timeOfDay: string): string {
  const key = `${archetype}:${timeOfDay}`;
  const pool = PRESENCE_LIBRARY[key] || PRESENCE_LIBRARY[`default:${timeOfDay}`] || ['presence noted'];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function AdaptivePresence({ timeCtx, mode, dominantArchetype = 'builder' }: Props) {
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const showNext = useCallback(() => {
    if (mode !== 'mirror') return;
    setDismissed(false);
    const next = selectPresenceText(dominantArchetype, timeCtx.timeOfDay);
    setText(next);
    setVisible(true);

    // Auto-fade after 10s
    setTimeout(() => setVisible(false), 10000);
  }, [mode, dominantArchetype, timeCtx.timeOfDay]);

  useEffect(() => {
    if (mode !== 'mirror') { setVisible(false); return; }

    // First appearance after 3s
    const first = setTimeout(showNext, 3000);

    // Then every 25s
    const interval = setInterval(showNext, 25000);

    return () => { clearTimeout(first); clearInterval(interval); };
  }, [mode, showNext]);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  const isShowing = visible && !dismissed && mode === 'mirror';

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'absolute',
        bottom: '4.5rem',
        left: '50%',
        transform: `translateX(-50%)`,
        zIndex: 10,
        opacity: isShowing ? 1 : 0,
        transition: 'opacity 1.2s ease',
        pointerEvents: isShowing ? 'auto' : 'none',
        cursor: 'pointer',
        textAlign: 'center',
        maxWidth: '400px',
        padding: '0 2rem',
      }}
    >
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.75rem',
        color: `rgba(255,255,255,${timeCtx.brightness * 0.45})`,
        letterSpacing: '0.12em',
        lineHeight: 1.6,
        display: 'block',
      }}>
        {text}
      </span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.55rem',
        color: 'rgba(255,255,255,0.12)',
        letterSpacing: '0.1em',
        display: 'block',
        marginTop: '0.4rem',
      }}>
        tap to dismiss · {dominantArchetype} · {timeCtx.timeOfDay}
      </span>
    </div>
  );
}
