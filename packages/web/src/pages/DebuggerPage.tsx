import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTx } from '../context/TxContext';
import {
  Bug, ChevronLeft, ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2,
  Layers, ArrowDown, ArrowUp, Minus, Plus
} from 'lucide-react';

/* ── Helpers ── */
function truncHex(hex: string, max = 20): string {
  if (!hex) return '‹empty›';
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

const CAT: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  push:   { text: '#a5a7ff', bg: 'rgba(129,131,255,0.12)', border: 'rgba(129,131,255,0.3)', glow: '0 0 20px rgba(129,131,255,0.15)' },
  stack:  { text: '#4ade80', bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.3)', glow: '0 0 20px rgba(74,222,128,0.15)' },
  crypto: { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.3)', glow: '0 0 20px rgba(251,191,36,0.15)' },
  arith:  { text: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.3)', glow: '0 0 20px rgba(96,165,250,0.15)' },
  flow:   { text: '#c084fc', bg: 'rgba(192,132,252,0.10)', border: 'rgba(192,132,252,0.3)', glow: '0 0 20px rgba(192,132,252,0.15)' },
  verify: { text: '#ffb689', bg: 'rgba(255,182,137,0.10)', border: 'rgba(255,182,137,0.3)', glow: '0 0 20px rgba(255,182,137,0.15)' },
  other:  { text: '#888', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', glow: 'none' },
};

/* ═══════════════════════════════════════════════════════════
   DebuggerPage — Visual Stack Debugger
   ═══════════════════════════════════════════════════════════ */
export default function DebuggerPage() {
  const navigate = useNavigate();
  const { debugTarget, setDebugTarget, debugSteps, debugLoading, fetchDebug, txid } = useTx();
  const [currentStep, setCurrentStep] = useState(0);
  const [animDir, setAnimDir] = useState<'forward' | 'backward'>('forward');
  const activeRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!debugTarget) { navigate('/'); return; }
    fetchDebug(debugTarget.scriptSig, debugTarget.scriptPubKey, debugTarget.witness);
    setCurrentStep(0);
  }, [debugTarget]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentStep]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!debugSteps) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [debugSteps, currentStep]);

  const goNext = useCallback(() => {
    if (!debugSteps) return;
    setAnimDir('forward');
    setCurrentStep(p => Math.min(p + 1, debugSteps.length - 1));
  }, [debugSteps]);

  const goPrev = useCallback(() => {
    setAnimDir('backward');
    setCurrentStep(p => Math.max(p - 1, 0));
  }, []);

  const stepTo = useCallback((idx: number) => {
    setAnimDir(idx > currentStep ? 'forward' : 'backward');
    setCurrentStep(idx);
  }, [currentStep]);

  if (!debugTarget) return null;

  const step = debugSteps?.[currentStep];
  const stackBefore = step?.stackBefore ?? [];
  const stackAfter = step?.stackAfter ?? [];
  const isComplete = debugSteps && currentStep === debugSteps.length - 1;
  const finalStep = debugSteps?.[debugSteps.length - 1];
  const hasError = finalStep?.error === 'VERIFY_FAILED' || finalStep?.error === 'STACK_EMPTY';
  const finalStack = finalStep?.stackAfter ?? [];
  const scriptPassed = !hasError && finalStack.length > 0 && finalStack[finalStack.length - 1] !== '00' && finalStack[finalStack.length - 1] !== '';
  const cat = step ? classifyOpcode(step.opcode) : 'other';
  const catStyle = CAT[cat];

  // Diff: what was added / removed
  const addedItems = stackAfter.filter((_, i) => i >= stackBefore.length);
  const removedCount = Math.max(0, stackBefore.length - (stackAfter.length - addedItems.length));

  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* ═══ LEFT: Opcode Step List ═══ */}
      <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#111414]/95 backdrop-blur-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <button
            onClick={() => { setDebugTarget(null); navigate('/'); }}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-white transition-colors font-mono text-[11px] group"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div>
            <p className="font-mono text-[11px] font-bold text-on-surface">Debug Session</p>
            <p className="font-mono text-[9px] text-on-surface-variant">
              Input #{debugTarget.inputIndex}
              {txid && <span className="opacity-40"> · {txid.substring(0, 10)}…</span>}
            </p>
          </div>
        </div>

        {/* Step list */}
        <div className="flex-grow overflow-y-auto scroll-fade">
          {debugLoading && (
            <div className="flex items-center justify-center h-32 gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-on-surface-variant font-mono text-[10px]">Loading…</span>
            </div>
          )}
          {!debugLoading && debugSteps?.map((s, i) => {
            const isActive = i === currentStep;
            const isPast = i < currentStep;
            const c = CAT[classifyOpcode(s.opcode)];
            return (
              <div
                key={i}
                ref={isActive ? activeRowRef : undefined}
                onClick={() => stepTo(i)}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-150 border-l-2 hover:bg-white/[0.04]"
                style={{
                  borderLeftColor: isActive ? c.text : 'transparent',
                  background: isActive ? c.bg : 'transparent',
                  opacity: !isPast && !isActive ? 0.4 : 1,
                }}
              >
                <span className="w-5 text-right font-mono text-[10px] tabular-nums" style={{ color: isActive ? c.text : isPast ? '#888' : '#666' }}>
                  {i.toString().padStart(2, '0')}
                </span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.text, opacity: isActive ? 1 : isPast ? 0.4 : 0.2 }} />
                <span className="font-mono text-[11px] truncate flex-grow" style={{ color: isActive ? '#fff' : isPast ? '#d1d5db' : '#9ca3af' }}>
                  {s.opcode}
                </span>
                {s.error && (
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: s.error === 'CHECKSIG_SKIPPED' ? '#fbbf24' : '#ff6b6b', opacity: isActive ? 1 : 0.6 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Prev / Next controls */}
        {debugSteps && (
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={currentStep === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded font-mono text-[10px] font-bold uppercase tracking-widest transition-all border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-on-surface-variant disabled:opacity-20"
            >
              <ArrowLeft className="w-3 h-3" /> Prev
            </button>
            <div className="font-mono text-[10px] text-on-surface-variant tabular-nums px-2">
              {currentStep + 1}/{debugSteps.length}
            </div>
            <button
              onClick={goNext}
              disabled={currentStep >= debugSteps.length - 1}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded font-mono text-[10px] font-bold uppercase tracking-widest transition-all border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-on-surface-variant disabled:opacity-20"
            >
              Next <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ═══ CENTER: Visual Stack Blocks ═══ */}
      <div className="flex-grow flex flex-col items-center justify-center relative overflow-hidden bg-[#0c0f0f]/85 backdrop-blur-lg">
        {/* Background gradient pulse */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 600px 400px at 50% 40%, ${catStyle.text}08, transparent 70%)`,
          transition: 'background 0.5s ease',
        }} />

        {/* Current opcode badge — big and central above stack */}
        {step && (
          <div className="mb-6 flex flex-col items-center gap-2 z-10">
            <span className="font-mono text-[9px] font-bold tracking-[0.15em] uppercase text-on-surface-variant/50">
              Step {currentStep + 1}
            </span>
            <div
              className="px-6 py-3 rounded-lg font-mono text-lg font-bold transition-all duration-300"
              style={{
                background: catStyle.bg,
                color: catStyle.text,
                border: `1px solid ${catStyle.border}`,
                boxShadow: catStyle.glow,
              }}
            >
              {step.opcode}
              <span className="text-xs font-normal ml-3 opacity-40 uppercase">{cat}</span>
            </div>
            {step.data && (
              <span className="font-mono text-[10px] px-3 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-on-surface-variant max-w-[300px] truncate">
                {truncHex(step.data, 40)}
              </span>
            )}
            {step.error && (
              <span className="font-mono text-[10px] px-3 py-1 rounded flex items-center gap-1.5" style={{
                background: step.error === 'CHECKSIG_SKIPPED' ? 'rgba(251,191,36,0.12)' : 'rgba(255,75,75,0.12)',
                color: step.error === 'CHECKSIG_SKIPPED' ? '#fbbf24' : '#ff6b6b',
                border: `1px solid ${step.error === 'CHECKSIG_SKIPPED' ? 'rgba(251,191,36,0.3)' : 'rgba(255,75,75,0.3)'}`,
              }}>
                <AlertTriangle className="w-3 h-3" />
                {step.error.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}

        {/* ─── Stack Visualization: Big Blocks ─── */}
        <div className="flex flex-col items-center gap-2 z-10 w-full max-w-[560px] px-6">
          {/* TOP label */}
          {stackAfter.length > 0 && (
            <div className="flex items-center gap-2 mb-1 self-start pl-2">
              <ArrowUp className="w-3 h-3 text-primary/50" />
              <span className="font-mono text-[8px] font-bold tracking-[0.2em] uppercase text-primary/50">Top of Stack</span>
            </div>
          )}

          {stackAfter.length === 0 ? (
            <div className="flex items-center justify-center h-40 w-full rounded-lg border border-dashed border-white/10">
              <span className="font-mono text-xs text-on-surface-variant/30 italic">‹ empty stack ›</span>
            </div>
          ) : (
            [...stackAfter].reverse().map((item, visualIdx) => {
              const realIdx = stackAfter.length - 1 - visualIdx;
              const isTop = visualIdx === 0;
              const isNew = realIdx >= stackBefore.length;
              const isChanged = !isNew && item !== stackBefore[realIdx];

              // Color logic: new=green, existing=indigo, changed=amber
              const blockColor = isNew ? '#4ade80' : isChanged ? '#fbbf24' : '#8183ff';
              const blockBg = isNew
                ? 'linear-gradient(135deg, rgba(74,222,128,0.25) 0%, rgba(74,222,128,0.12) 100%)'
                : isChanged
                ? 'linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.12) 100%)'
                : 'linear-gradient(135deg, rgba(129,131,255,0.18) 0%, rgba(129,131,255,0.08) 100%)';
              const blockShadow = isNew
                ? '0 4px 24px rgba(74,222,128,0.15), inset 0 1px 0 rgba(74,222,128,0.2)'
                : isChanged
                ? '0 4px 24px rgba(251,191,36,0.1), inset 0 1px 0 rgba(251,191,36,0.15)'
                : isTop
                ? '0 4px 24px rgba(129,131,255,0.12), inset 0 1px 0 rgba(129,131,255,0.15)'
                : '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)';

              return (
                <div
                  key={`${currentStep}-${realIdx}`}
                  className="w-full rounded-md px-4 py-3 font-mono text-sm flex items-center gap-3 transition-all duration-300"
                  style={{
                    background: blockBg,
                    border: `1px solid ${blockColor}${isTop || isNew ? '40' : '18'}`,
                    boxShadow: blockShadow,
                    animation: isNew && animDir === 'forward' ? 'slideInDown 0.35s cubic-bezier(0.23,1,0.32,1)' : undefined,
                  }}
                >
                  {/* Position */}
                  <span className="text-[10px] w-8 text-right flex-shrink-0 tabular-nums font-bold" style={{ color: isTop ? blockColor : '#555' }}>
                    {isTop ? 'TOP' : `#${realIdx}`}
                  </span>

                  {/* Vertical bar accent */}
                  <div className="w-0.5 h-5 rounded-full flex-shrink-0" style={{ background: blockColor, opacity: isTop || isNew ? 0.8 : 0.25 }} />

                  {/* Value */}
                  <span className="flex-grow truncate" style={{ color: isNew ? '#4ade80' : isChanged ? '#fbbf24' : isTop ? '#e2e2e2' : '#999' }} title={item}>
                    {item || '‹empty›'}
                  </span>

                  {/* Badge */}
                  {isNew && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#4ade80]/15 text-[#4ade80] border border-[#4ade80]/25 flex-shrink-0">
                      Pushed
                    </span>
                  )}
                  {isChanged && !isNew && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/25 flex-shrink-0">
                      Modified
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* BOTTOM label */}
          {stackAfter.length > 1 && (
            <div className="flex items-center gap-2 mt-1 self-start pl-2">
              <ArrowDown className="w-3 h-3 text-on-surface-variant/30" />
              <span className="font-mono text-[8px] font-bold tracking-[0.2em] uppercase text-on-surface-variant/30">Bottom</span>
            </div>
          )}
        </div>

        {/* ─── Execution Result ─── */}
        {isComplete && (
          <div
            className="mt-8 px-8 py-4 rounded-lg flex items-center gap-4 z-10 transition-all duration-500"
            style={{
              background: scriptPassed
                ? 'linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(74,222,128,0.02) 100%)'
                : 'linear-gradient(135deg, rgba(255,75,75,0.08) 0%, rgba(255,75,75,0.02) 100%)',
              border: `1px solid ${scriptPassed ? 'rgba(74,222,128,0.2)' : 'rgba(255,75,75,0.2)'}`,
              boxShadow: scriptPassed ? '0 0 40px rgba(74,222,128,0.08)' : '0 0 40px rgba(255,75,75,0.08)',
            }}
          >
            {scriptPassed ? (
              <CheckCircle2 className="w-6 h-6 text-[#4ade80]" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-[#ff6b6b]" />
            )}
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-widest" style={{ color: scriptPassed ? '#4ade80' : '#ff6b6b' }}>
                {scriptPassed ? 'Script Valid' : 'Script Failed'}
              </p>
              <p className="font-mono text-[10px] text-on-surface-variant">
                {scriptPassed ? 'Top of stack is truthy — spending conditions met' : (finalStep?.error?.replace(/_/g, ' ') ?? 'Stack is empty or top is falsy')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT: Step Details Panel ═══ */}
      <div className="w-[240px] flex-shrink-0 border-l border-white/[0.06] flex flex-col bg-[#111414]/90 backdrop-blur-xl">
        {/* Current opcode detail */}
        {step && (
          <div className="p-5 border-b border-white/[0.06]">
            <p className="font-mono text-[9px] font-bold tracking-[0.15em] uppercase text-on-surface-variant/60 mb-3">Executing</p>
            <div
              className="px-4 py-2.5 rounded-md font-mono text-[13px] font-bold"
              style={{
                background: catStyle.bg,
                color: catStyle.text,
                border: `1px solid ${catStyle.border}`,
              }}
            >
              {step.opcode}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: catStyle.text }} />
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: catStyle.text }}>{cat}</span>
            </div>
          </div>
        )}

        {/* Stack changes */}
        <div className="p-5 border-b border-white/[0.06] flex-grow">
          <p className="font-mono text-[9px] font-bold tracking-[0.15em] uppercase text-on-surface-variant/60 mb-3">Stack Changes</p>

          {removedCount > 0 && (
            <div className="flex flex-col gap-1.5 mb-4">
              {Array.from({ length: removedCount }).map((_, i) => {
                const removedItem = stackBefore[stackBefore.length - removedCount + i];
                return (
                  <div key={`r-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#ff6b6b]/[0.06] border border-[#ff6b6b]/15">
                    <Minus className="w-3 h-3 text-[#ff6b6b] flex-shrink-0" />
                    <span className="font-mono text-[10px] text-[#ff6b6b]/80 truncate">{truncHex(removedItem, 18)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {addedItems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {addedItems.map((item, i) => (
                <div key={`a-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#4ade80]/[0.06] border border-[#4ade80]/15">
                  <Plus className="w-3 h-3 text-[#4ade80] flex-shrink-0" />
                  <span className="font-mono text-[10px] text-[#4ade80]/80 truncate">{truncHex(item, 18)}</span>
                </div>
              ))}
            </div>
          )}

          {removedCount === 0 && addedItems.length === 0 && step && (
            <div className="font-mono text-[10px] text-on-surface-variant/30 italic">No stack changes</div>
          )}
        </div>

        {/* Stack summary */}
        <div className="p-5">
          <p className="font-mono text-[9px] font-bold tracking-[0.15em] uppercase text-on-surface-variant/60 mb-2">Stack Summary</p>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-on-surface-variant">Items</span>
            <span className="text-primary font-bold">{stackAfter.length}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] mt-1">
            <span className="text-on-surface-variant">Depth</span>
            <span className="text-on-surface-variant">{stackAfter.length}</span>
          </div>
          {stackAfter.length > 0 && (
            <div className="flex items-center justify-between font-mono text-[11px] mt-1">
              <span className="text-on-surface-variant">Top</span>
              <span className="text-on-surface truncate max-w-[120px]" title={stackAfter[stackAfter.length - 1]}>
                {truncHex(stackAfter[stackAfter.length - 1], 14)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CSS Animations ═══ */}
      <style>{`
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
