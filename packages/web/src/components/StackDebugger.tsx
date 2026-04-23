import React, { useEffect, useState } from 'react';
import { useTx } from '../context/TxContext';
import { Bug, ArrowLeft, ArrowRight } from 'lucide-react';

export function StackDebugger() {
  const { debugTarget, setDebugTarget, debugSteps, debugLoading, fetchDebug } = useTx();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (debugTarget) {
      fetchDebug(debugTarget.scriptSig, debugTarget.scriptPubKey, debugTarget.witness);
      setCurrentStepIndex(0);
    }
  }, [debugTarget]); // fetch once when target changes

  if (!debugTarget) return null;

  return (
    <div className="bg-black/40 backdrop-blur-xl p-6 flex flex-col gap-4 relative border border-white/10 rounded-lg shadow-2xl w-full">
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Bug className="w-5 h-5 text-primary-container" />
          <h3 className="text-xl font-bold text-on-surface font-display-xl tracking-tighter">Stack Debugger <span className="text-xs font-mono font-normal opacity-50 ml-2">Input #{debugTarget.inputIndex}</span></h3>
        </div>
        <div className="flex gap-2 items-center">
          {debugSteps && (
            <>
              <button 
                onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                disabled={currentStepIndex === 0}
                className="border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface flex items-center gap-1 transition-colors rounded disabled:opacity-30"
              >
                <ArrowLeft className="w-3 h-3" /> Prev
              </button>
              <button 
                onClick={() => setCurrentStepIndex(Math.min(debugSteps.length - 1, currentStepIndex + 1))}
                disabled={currentStepIndex >= debugSteps.length - 1}
                className="border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface flex items-center gap-1 transition-colors rounded disabled:opacity-30"
              >
                Next <ArrowRight className="w-3 h-3" />
              </button>
            </>
          )}
          <button onClick={() => setDebugTarget(null)} className="ml-4 hover:text-error transition-colors text-on-surface-variant font-mono">✕</button>
        </div>
      </div>
      
      <div className="flex flex-col gap-2 font-mono text-sm overflow-y-auto max-h-[400px] p-2">
        {debugLoading && <div className="animate-pulse opacity-50 text-on-surface-variant">Initializing debug session...</div>}
        
        {!debugLoading && debugSteps && debugSteps.map((step, i) => {
          const isActive = i === currentStepIndex;
          const isPast = i < currentStepIndex;
          const isFuture = i > currentStepIndex;
          
          if (isFuture) {
             if (i === currentStepIndex + 1) {
               return (
                  <div key={i} className="flex items-center gap-4 p-2 opacity-50">
                    <span className="text-surface-variant w-8">{i.toString().padStart(2, '0')}</span>
                    <span className="text-on-surface-variant w-32">{step.opcode}</span>
                    <div className="flex gap-2 flex-grow">
                      <span className="text-surface-variant text-xs italic">pending execution...</span>
                    </div>
                  </div>
               );
             }
             return null;
          }
          
          return (
            <div key={i} className={isActive ? "flex items-center gap-4 p-2 bg-thread-dim border-l-2 border-l-thread-active border-y border-r border-white/10 rounded-r" : "flex items-center gap-4 p-2 hover:bg-surface-variant/30 border border-transparent hover:border-white/5 rounded"}>
              <span className={isActive ? "text-primary w-8" : "text-surface-variant w-8"}>
                {isActive ? '>' : ''}{i.toString().padStart(2, '0')}
              </span>
              <span className={`w-32 ${isActive ? 'text-on-surface font-bold' : 'text-on-surface-variant'} ${step.error ? 'text-error' : ''}`}>
                {step.opcode}
              </span>
              <div className="flex gap-2 flex-grow items-center flex-wrap">
                {step.data && <span className="px-2 py-0.5 border border-primary text-primary bg-primary/10 rounded text-[10px] break-all max-w-[200px] truncate">{step.data}</span>}
                
                {step.error && <span className="px-2 py-0.5 border border-error text-error bg-error/10 rounded text-[10px]">{step.error}</span>}

                {/* Display Stack After if active or past */}
                {step.stackAfter.length > 0 ? (
                  <>
                    <ArrowRight className="w-3 h-3 text-surface-variant mx-1" />
                    {step.stackAfter.map((item, j) => {
                      const beforeItem = step.stackBefore[j];
                      const isNew = beforeItem !== item && j >= step.stackBefore.length - 1;
                      if (isActive && isNew) {
                         return <span key={j} className="px-2 py-0.5 border border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10 rounded text-[10px] max-w-[120px] truncate">{item}</span>;
                      }
                      return <span key={j} className="px-2 py-0.5 border border-surface-variant text-on-surface-variant bg-surface-variant/10 rounded text-[10px] max-w-[120px] truncate">{item}</span>;
                    })}
                  </>
                ) : (
                  <span className="text-surface-variant text-xs italic ml-2">&lt;empty stack&gt;</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
