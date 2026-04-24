import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTx } from '../context/TxContext';
import {
  Bug, ArrowLeft, ArrowRight, Play, Pause, SkipBack, SkipForward,
  ChevronDown, ChevronUp, X, Zap, Layers, AlertTriangle, CheckCircle2
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function truncHex(hex: string, max = 12): string {
  if (hex.length <= max) return hex;
  return hex.slice(0, max / 2) + '…' + hex.slice(-max / 2);
}

function classifyOpcode(name: string): 'push' | 'stack' | 'crypto' | 'arith' | 'flow' | 'verify' | 'other' {
  if (name.startsWith('PUSHDATA') || name.startsWith('WITNESS') || name.startsWith('OP_0') || /^OP_\d+$/.test(name)) return 'push';
  if (['OP_DUP','OP_2DUP','OP_3DUP','OP_DROP','OP_2DROP','OP_NIP','OP_OVER','OP_2OVER','OP_SWAP','OP_2SWAP','OP_ROT','OP_2ROT','OP_PICK','OP_ROLL','OP_TUCK','OP_IFDUP','OP_DEPTH','OP_SIZE','OP_TOALTSTACK','OP_FROMALTSTACK'].includes(name)) return 'stack';
  if (['OP_SHA256','OP_SHA1','OP_HASH160','OP_HASH256','OP_RIPEMD160','OP_CHECKSIG','OP_CHECKSIGVERIFY','OP_CHECKMULTISIG','OP_CHECKMULTISIGVERIFY'].includes(name)) return 'crypto';
  if (['OP_ADD','OP_SUB','OP_1ADD','OP_1SUB','OP_NEGATE','OP_ABS','OP_NOT','OP_0NOTEQUAL','OP_BOOLAND','OP_BOOLOR','OP_NUMEQUAL','OP_NUMEQUALVERIFY','OP_NUMNOTEQUAL','OP_LESSTHAN','OP_GREATERTHAN','OP_LESSTHANOREQUAL','OP_GREATERTHANOREQUAL','OP_MIN','OP_MAX','OP_WITHIN'].includes(name)) return 'arith';
  if (['OP_IF','OP_NOTIF','OP_ELSE','OP_ENDIF'].includes(name)) return 'flow';
  if (['OP_VERIFY','OP_EQUAL','OP_EQUALVERIFY','OP_RETURN','OP_CHECKLOCKTIMEVERIFY','OP_CHECKSEQUENCEVERIFY'].includes(name)) return 'verify';
  return 'other';
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  push:   { bg: 'rgba(129,131,255,0.12)', text: '#a5a7ff', border: 'rgba(129,131,255,0.3)' },
  stack:  { bg: 'rgba(74,222,128,0.10)', text: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  crypto: { bg: 'rgba(251,191,36,0.10)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  arith:  { bg: 'rgba(96,165,250,0.10)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  flow:   { bg: 'rgba(192,132,252,0.10)', text: '#c084fc', border: 'rgba(192,132,252,0.3)' },
  verify: { bg: 'rgba(255,182,137,0.10)', text: '#ffb689', border: 'rgba(255,182,137,0.3)' },
  other:  { bg: 'rgba(255,255,255,0.05)', text: '#888', border: 'rgba(255,255,255,0.1)' },
};

const SPEED_OPTIONS = [0.5, 1, 2, 4];

/* ------------------------------------------------------------------ */
/* StackDebugger Component                                             */
/* ------------------------------------------------------------------ */
export function StackDebugger() {
  const { debugTarget, setDebugTarget, debugSteps, debugLoading, fetchDebug } = useTx();
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showStackPanel, setShowStackPanel] = useState(true);
  const [hoveredStackItem, setHoveredStackItem] = useState<number | null>(null);
  const stepListRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  // Fetch debug data on target change
  useEffect(() => {
    if (debugTarget) {
      fetchDebug(debugTarget.scriptSig, debugTarget.scriptPubKey, debugTarget.witness);
      setCurrentStep(0);
      setPlaying(false);
    }
  }, [debugTarget]);

  // Auto-play timer
  useEffect(() => {
    if (!playing || !debugSteps) return;
    if (currentStep >= debugSteps.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => {
      setCurrentStep(prev => Math.min(prev + 1, debugSteps.length - 1));
    }, 800 / speed);
    return () => clearTimeout(timer);
  }, [playing, currentStep, speed, debugSteps]);

  // Scroll active row into view
  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStep]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!debugSteps) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentStep(prev => Math.min(prev + 1, debugSteps.length - 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentStep(prev => Math.max(prev - 1, 0));
      }
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying(p => !p);
      }
      if (e.key === 'Home') { e.preventDefault(); setCurrentStep(0); }
      if (e.key === 'End' && debugSteps) { e.preventDefault(); setCurrentStep(debugSteps.length - 1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [debugSteps]);

  const stepTo = useCallback((idx: number) => {
    setPlaying(false);
    setCurrentStep(idx);
  }, []);

  if (!debugTarget) return null;

  const step = debugSteps?.[currentStep];
  const prevStep = currentStep > 0 ? debugSteps?.[currentStep - 1] : null;

  // Compute stack diff: items added / removed
  const stackBefore = step?.stackBefore ?? [];
  const stackAfter = step?.stackAfter ?? [];
  const removed = stackBefore.filter((item, i) => !stackAfter.includes(item) || stackBefore.length > stackAfter.length);
  const added = stackAfter.filter((item, i) => i >= stackBefore.length || item !== stackBefore[i]);

  // Derive execution result
  const isComplete = debugSteps && currentStep === debugSteps.length - 1;
  const finalStep = debugSteps?.[debugSteps.length - 1];
  const hasError = finalStep?.error === 'VERIFY_FAILED' || finalStep?.error === 'STACK_EMPTY';
  const finalStack = finalStep?.stackAfter ?? [];
  const scriptPassed = !hasError && finalStack.length > 0 && finalStack[finalStack.length - 1] !== '00' && finalStack[finalStack.length - 1] !== '';

  return (
    <div
      className="bg-black/60 backdrop-blur-xl flex flex-col relative border border-white/10 rounded-lg shadow-2xl w-full overflow-hidden"
      style={{ boxShadow: '0 0 60px rgba(129,131,255,0.08), 0 4px 32px rgba(0,0,0,0.4)' }}
    >
      {/* ── Header ── */}
      <div className="flex justify-between items-center border-b border-white/10 px-6 py-4 bg-black/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8183ff 0%, #c084fc 100%)' }}>
            <Bug className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface tracking-tight flex items-center gap-2">
              Stack Debugger
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded border border-white/10 bg-white/5 text-on-surface-variant">
                INPUT #{debugTarget.inputIndex}
              </span>
            </h3>
            {debugSteps && (
              <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">
                Step {currentStep + 1} / {debugSteps.length}
                {step && <span className="ml-2 opacity-60">· {classifyOpcode(step.opcode).toUpperCase()}</span>}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setDebugTarget(null)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Transport Controls ── */}
      {debugSteps && (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 bg-black/20">
          {/* Playback buttons */}
          <div className="flex items-center gap-1">
            <button onClick={() => stepTo(0)} className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all" title="Reset (Home)">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => stepTo(Math.max(0, currentStep - 1))} disabled={currentStep === 0} className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all disabled:opacity-20" title="Previous (←)">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPlaying(p => !p)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: playing ? 'rgba(255,182,137,0.15)' : 'rgba(129,131,255,0.15)',
                color: playing ? '#ffb689' : '#c1c1ff',
                border: `1px solid ${playing ? 'rgba(255,182,137,0.3)' : 'rgba(129,131,255,0.3)'}`,
              }}
              title="Play/Pause (Space)"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button onClick={() => stepTo(Math.min(debugSteps.length - 1, currentStep + 1))} disabled={currentStep >= debugSteps.length - 1} className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all disabled:opacity-20" title="Next (→)">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => stepTo(debugSteps.length - 1)} className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all" title="End (End)">
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex-grow mx-3 relative h-1.5 bg-white/5 rounded-full overflow-hidden cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              stepTo(Math.round(pct * (debugSteps.length - 1)));
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
              style={{
                width: `${((currentStep + 1) / debugSteps.length) * 100}%`,
                background: step?.error ? 'linear-gradient(90deg, #c1c1ff, #ff6b6b)' : 'linear-gradient(90deg, #c1c1ff, #8183ff)',
              }}
            />
            {/* Step markers for errors */}
            {debugSteps.map((s, i) => s.error && (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-1 rounded-full"
                style={{
                  left: `${(i / debugSteps.length) * 100}%`,
                  background: s.error === 'CHECKSIG_SKIPPED' ? '#fbbf24' : '#ff6b6b',
                }}
              />
            ))}
          </div>

          {/* Speed control */}
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-on-surface-variant" />
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="font-mono text-[9px] px-1.5 py-0.5 rounded transition-all"
                style={{
                  background: speed === s ? 'rgba(129,131,255,0.2)' : 'transparent',
                  color: speed === s ? '#c1c1ff' : '#666',
                  border: speed === s ? '1px solid rgba(129,131,255,0.3)' : '1px solid transparent',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex flex-col lg:flex-row">
        {/* Left: Step List */}
        <div ref={stepListRef} className="flex-grow overflow-y-auto max-h-[420px] font-mono text-xs scroll-fade border-r border-white/5">
          {debugLoading && (
            <div className="flex items-center justify-center h-32 gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-on-surface-variant text-xs">Initializing debug session…</span>
            </div>
          )}

          {!debugLoading && debugSteps?.map((s, i) => {
            const isActive = i === currentStep;
            const isPast = i < currentStep;
            const cat = classifyOpcode(s.opcode);
            const colors = CATEGORY_COLORS[cat];

            return (
              <div
                key={i}
                ref={isActive ? activeRowRef : undefined}
                onClick={() => stepTo(i)}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-150 group border-l-2"
                style={{
                  borderLeftColor: isActive ? colors.text : 'transparent',
                  background: isActive ? colors.bg : isPast ? 'rgba(255,255,255,0.01)' : 'transparent',
                  opacity: !isPast && !isActive ? 0.35 : 1,
                }}
              >
                {/* Step number */}
                <span className="w-6 text-right tabular-nums" style={{ color: isActive ? colors.text : '#555' }}>
                  {i.toString().padStart(2, '0')}
                </span>

                {/* Category dot */}
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.text, opacity: isActive ? 1 : 0.4 }} />

                {/* Opcode name */}
                <span
                  className="w-36 truncate font-medium"
                  style={{ color: isActive ? '#fff' : isPast ? '#bbb' : '#666' }}
                >
                  {s.opcode}
                </span>

                {/* Data badge */}
                {s.data && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] truncate max-w-[100px]" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                    {truncHex(s.data, 16)}
                  </span>
                )}

                {/* Error badge */}
                {s.error && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1"
                    style={{
                      background: s.error === 'CHECKSIG_SKIPPED' ? 'rgba(251,191,36,0.12)' : 'rgba(255,75,75,0.12)',
                      color: s.error === 'CHECKSIG_SKIPPED' ? '#fbbf24' : '#ff6b6b',
                      border: `1px solid ${s.error === 'CHECKSIG_SKIPPED' ? 'rgba(251,191,36,0.3)' : 'rgba(255,75,75,0.3)'}`,
                    }}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {s.error.replace(/_/g, ' ')}
                  </span>
                )}

                {/* Mini stack count */}
                <span className="ml-auto text-[9px] tabular-nums" style={{ color: '#555' }}>
                  [{s.stackAfter.length}]
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: Interactive Stack State Panel */}
        {showStackPanel && debugSteps && step && (
          <div className="w-full lg:w-[260px] flex-shrink-0 flex flex-col border-t lg:border-t-0 border-white/5">
            {/* Stack header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Stack State</span>
              </div>
              <span className="font-mono text-[10px] text-primary">{stackAfter.length} items</span>
            </div>

            {/* Current opcode display */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-on-surface-variant">Executing</span>
              </div>
              <div
                className="px-3 py-2 rounded-md font-mono text-sm font-bold"
                style={{
                  background: CATEGORY_COLORS[classifyOpcode(step.opcode)].bg,
                  color: CATEGORY_COLORS[classifyOpcode(step.opcode)].text,
                  border: `1px solid ${CATEGORY_COLORS[classifyOpcode(step.opcode)].border}`,
                }}
              >
                {step.opcode}
                <span className="text-[9px] font-normal ml-2 opacity-60">{classifyOpcode(step.opcode)}</span>
              </div>
            </div>

            {/* Visual Stack (top of stack at top) */}
            <div className="flex-grow overflow-y-auto max-h-[280px] p-3 flex flex-col gap-1">
              {stackAfter.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-on-surface-variant text-[10px] font-mono italic opacity-50">
                  ‹ empty stack ›
                </div>
              ) : (
                [...stackAfter].reverse().map((item, visualIdx) => {
                  const realIdx = stackAfter.length - 1 - visualIdx;
                  const isTop = visualIdx === 0;
                  const isNewItem = realIdx >= stackBefore.length;
                  const isChanged = !isNewItem && item !== stackBefore[realIdx];
                  const isHovered = hoveredStackItem === realIdx;

                  return (
                    <div
                      key={`${realIdx}-${item}`}
                      onMouseEnter={() => setHoveredStackItem(realIdx)}
                      onMouseLeave={() => setHoveredStackItem(null)}
                      className="relative group cursor-default transition-all duration-200"
                      style={{
                        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                      }}
                    >
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-md font-mono text-[11px] transition-all duration-200"
                        style={{
                          background: isNewItem
                            ? 'rgba(74,222,128,0.08)'
                            : isChanged
                            ? 'rgba(251,191,36,0.08)'
                            : isHovered
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${
                            isNewItem ? 'rgba(74,222,128,0.25)' : isChanged ? 'rgba(251,191,36,0.25)' : isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'
                          }`,
                        }}
                      >
                        {/* Position indicator */}
                        <span className="text-[9px] w-4 text-right flex-shrink-0" style={{ color: isTop ? '#c1c1ff' : '#555' }}>
                          {isTop ? '⤒' : realIdx}
                        </span>

                        {/* Value */}
                        <span
                          className="truncate flex-grow"
                          style={{
                            color: isNewItem ? '#4ade80' : isChanged ? '#fbbf24' : '#ccc',
                          }}
                          title={item}
                        >
                          {item || '‹empty›'}
                        </span>

                        {/* Badge */}
                        {isNewItem && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20 flex-shrink-0">
                            NEW
                          </span>
                        )}
                        {isChanged && !isNewItem && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20 flex-shrink-0">
                            MOD
                          </span>
                        )}
                      </div>

                      {/* Expanded value on hover */}
                      {isHovered && item.length > 24 && (
                        <div
                          className="absolute left-0 right-0 -bottom-1 translate-y-full z-50 p-2 rounded-md font-mono text-[10px] break-all"
                          style={{
                            background: 'rgba(18,20,20,0.97)',
                            border: '1px solid rgba(129,131,255,0.2)',
                            color: '#e2e2e2',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          }}
                        >
                          {item}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Removed items indicator */}
            {stackBefore.length > stackAfter.length && (
              <div className="px-4 py-2 border-t border-white/5">
                <div className="flex items-center gap-1 text-[9px] font-mono text-error/70">
                  <span className="text-error">−{stackBefore.length - stackAfter.length}</span>
                  <span>popped from stack</span>
                </div>
              </div>
            )}

            {/* Execution result */}
            {isComplete && (
              <div
                className="px-4 py-3 border-t border-white/5 flex items-center gap-2"
                style={{
                  background: scriptPassed ? 'rgba(74,222,128,0.06)' : 'rgba(255,75,75,0.06)',
                }}
              >
                {scriptPassed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-[#4ade80] uppercase tracking-widest">Script Valid</p>
                      <p className="font-mono text-[9px] text-on-surface-variant">Top of stack is truthy</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-error" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-error uppercase tracking-widest">Script Failed</p>
                      <p className="font-mono text-[9px] text-on-surface-variant">{finalStep?.error?.replace(/_/g, ' ') ?? 'Empty stack'}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stack Panel Toggle ── */}
      <button
        onClick={() => setShowStackPanel(p => !p)}
        className="absolute top-4 right-12 w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
        title={showStackPanel ? 'Hide Stack Panel' : 'Show Stack Panel'}
      >
        <Layers className="w-3.5 h-3.5" />
      </button>

      {/* ── Keyboard Shortcuts Hint ── */}
      <div className="px-6 py-2 border-t border-white/5 flex items-center gap-4 text-[9px] font-mono text-on-surface-variant/50">
        <span>← → step</span>
        <span>SPACE play/pause</span>
        <span>HOME reset</span>
        <span>END jump to end</span>
        <span>Click any step to seek</span>
      </div>
    </div>
  );
}
