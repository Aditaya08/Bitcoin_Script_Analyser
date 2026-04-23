import React from 'react';
import DigitalLoomBackground from './components/ui/digital-loom-background';
import { 
  Plus, Receipt, Eye, Code, Layers, List, Rss, FileText, HelpCircle, 
  Settings, User, ArrowRight, Bug, ArrowLeft 
} from 'lucide-react';
import { TxProvider, useTx } from './context/TxContext';
import { TxSearch } from './components/TxSearch';
import { StackDebugger } from './components/StackDebugger';
import { OpcodeRef } from './components/OpcodeRef';

function AppContent() {
  const { analysis, setDebugTarget, debugTarget, debugSteps } = useTx();

  return (
    <DigitalLoomBackground backgroundColor="#0c0f0f" threadColor="rgba(129, 131, 255, 0.4)" threadCount={120}>
      <div className="fixed inset-0 z-20 flex h-screen overflow-hidden text-on-surface font-sans selection:bg-primary/30">
        
        {/* SideNavBar */}
        <nav className="fixed left-0 top-0 h-full flex-col pt-20 bg-black/40 backdrop-blur-lg border-r border-white/10 z-40 hidden md:flex w-64">
          <div className="px-6 mb-8">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <span className="text-white">Script</span><span className="text-primary-container">Scope</span>
            </h1>
            <p className="font-mono text-xs text-on-surface-variant mt-1">v1.0.4-alpha</p>
          </div>
          
          <div className="px-4 mb-6">
            <button className="w-full flex items-center justify-center gap-2 border border-thread-border bg-thread-dim hover:bg-thread-active hover:text-white transition-colors py-2 rounded text-on-surface font-medium">
              <Plus className="w-4 h-4" /> New Analysis
            </button>
          </div>
          
          <ul className="flex flex-col gap-1 px-2 flex-grow">
            <li>
              <a className="flex items-center gap-3 px-4 py-2 bg-primary/10 text-primary border-l-2 border-primary font-mono text-sm" href="#">
                <Receipt className="w-4 h-4" /> Transaction
              </a>
            </li>
            <li>
              <a className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-white hover:bg-white/5 font-mono text-sm transition-colors" href="#">
                <Eye className="w-4 h-4" /> Witness
              </a>
            </li>
            <li>
              <a className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-white hover:bg-white/5 font-mono text-sm transition-colors" href="#">
                <Code className="w-4 h-4" /> Scripts
              </a>
            </li>
            <li>
              <a className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-white hover:bg-white/5 font-mono text-sm transition-colors" href="#">
                <Layers className="w-4 h-4" /> Stack
              </a>
            </li>
            <li>
              <a className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-white hover:bg-white/5 font-mono text-sm transition-colors" href="#">
                <List className="w-4 h-4" /> Opcodes
              </a>
            </li>
          </ul>
          
          <div className="mt-auto px-2 pb-6 border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 px-4 py-2 text-on-surface-variant mb-2">
              <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
                <Rss className="w-4 h-4 text-on-surface" />
              </div>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface">Node Status</p>
                <p className="text-[10px] text-primary">Synced</p>
              </div>
            </div>
            <ul className="flex flex-col gap-1">
              <li>
                <a className="flex items-center gap-3 px-4 py-1.5 text-on-surface-variant hover:text-white hover:bg-white/5 font-mono text-sm transition-colors" href="#">
                  <FileText className="w-4 h-4" /> Docs
                </a>
              </li>
              <li>
                <a className="flex items-center gap-3 px-4 py-1.5 text-on-surface-variant hover:text-white hover:bg-white/5 font-mono text-sm transition-colors" href="#">
                  <HelpCircle className="w-4 h-4" /> Support
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* TopAppBar */}
        <header className="fixed top-0 w-full h-16 bg-black/25 backdrop-blur-md border-b border-white/10 flex justify-between items-center px-6 z-50 md:pl-72">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase md:hidden flex items-center gap-1">
              <span>SCRIPT</span><span className="text-primary-container">SCOPE</span>
            </h1>
            <span className="hidden md:inline-block font-mono text-[10px] font-bold tracking-widest border border-white/10 px-2 py-1 rounded bg-surface-container-low text-on-surface-variant">BITCOIN SCRIPT ANALYZER · MAINNET</span>
          </div>
          
          <div className="flex items-center gap-8">
            <nav className="hidden lg:flex gap-6">
              <a className="text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors font-mono text-sm px-2 py-1" href="#">Dashboard</a>
              <a className="text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors font-mono text-sm px-2 py-1" href="#">Mempool</a>
              <a className="text-primary border-b-2 border-primary pb-1 font-mono text-sm px-2 py-1" href="#">Debugger</a>
              <a className="text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors font-mono text-sm px-2 py-1" href="#">Network</a>
            </nav>
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <button className="text-on-surface-variant hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <button className="text-on-surface-variant hover:text-white transition-colors">
                <User className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <main className="flex-1 h-full overflow-y-auto pt-24 pb-12 px-6 md:pl-[288px] w-full max-w-[1600px] mx-auto flex flex-col gap-6 relative">
          
          {/* Search Bar - Integrated Component */}
          <TxSearch />

          {!analysis ? (
            <div className="flex items-center justify-center h-64 text-on-surface-variant font-mono text-sm border border-dashed border-white/10 rounded">
              Enter a transaction ID to analyze
            </div>
          ) : (
            <>
              {/* Meta Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <div className="bg-black/60 backdrop-blur-md p-4 flex flex-col gap-1 border-l-2 border-l-surface-variant border-y border-r border-white/10 rounded-r">
                  <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">TXID</span>
                  <span className="font-mono text-sm text-on-surface truncate" title={analysis.txid}>{analysis.txid.substring(0, 16)}...</span>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-4 flex flex-col gap-1 border-l-2 border-l-surface-variant border-y border-r border-white/10 rounded-r">
                  <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">SIZE</span>
                  <span className="font-mono text-sm text-on-surface">{analysis.vsize} <span className="text-surface-variant">vB</span></span>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-4 flex flex-col gap-1 border-l-2 border-l-surface-variant border-y border-r border-white/10 rounded-r">
                  <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">FEE</span>
                  <span className="font-mono text-sm text-on-surface">{analysis.fee} <span className="text-surface-variant">sat</span></span>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-4 flex flex-col gap-1 border-l-2 border-l-surface-variant border-y border-r border-white/10 rounded-r">
                  <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">FEE RATE</span>
                  <span className="font-mono text-sm text-on-surface">{analysis.feerate.toFixed(1)} <span className="text-surface-variant">sat/vB</span></span>
                </div>
              </div>

              {/* Content Layout */}
              <div className="flex flex-col xl:flex-row gap-6 w-full pb-20">
                
                {/* Left Panel (Main Content) */}
                <div className="flex-grow flex flex-col gap-6">
                  
                  {/* Inputs */}
                  {analysis.inputs.map((input, i) => (
                    <div key={i} className={`bg-black/60 backdrop-blur-md p-6 border-l-2 ${debugTarget?.inputIndex === i ? 'border-l-primary' : 'border-l-primary-container'} border-y border-r border-white/10 rounded-r relative`}>
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                          onClick={() => setDebugTarget({ inputIndex: i, scriptSig: input.scriptSigHex, scriptPubKey: input.prevoutScriptPubKeyHex || '', witness: input.witness })}
                          className="font-mono text-[10px] font-bold tracking-widest border border-primary text-primary px-3 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors uppercase flex items-center gap-1"
                        >
                          <Bug className="w-3 h-3" /> Debug
                        </button>
                        <span className="font-mono text-[10px] font-bold tracking-widest border border-tertiary text-tertiary px-2 py-0.5 rounded bg-tertiary/10">{input.scriptType}</span>
                      </div>
                      <h2 className="font-mono text-[10px] font-bold tracking-widest text-on-surface-variant mb-4 uppercase">INPUT #{i}</h2>
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-4 items-baseline border-b border-white/5 pb-2">
                          <span className="font-mono text-xs text-surface-variant w-24">prevout</span>
                          <span className="font-mono text-sm text-on-surface break-all">{input.prevout}</span>
                        </div>
                        <div className="flex gap-4 items-baseline border-b border-white/5 pb-2">
                          <span className="font-mono text-xs text-surface-variant w-24">scriptSig</span>
                          {input.scriptSigAsm ? (
                             <span className="font-mono text-sm text-on-surface break-all">{input.scriptSigAsm}</span>
                          ) : (
                             <span className="font-mono text-sm text-on-surface italic opacity-50">&lt;empty&gt;</span>
                          )}
                        </div>
                        <div className="flex gap-4 items-start">
                          <span className="font-mono text-xs text-surface-variant w-24 pt-1">witness</span>
                          {input.witness && input.witness.length > 0 ? (
                            <div className="flex flex-col gap-2 w-full">
                              {input.witness.map((w, j) => (
                                <div key={j} className="bg-black/40 p-2 border border-white/5 font-mono text-xs text-on-surface break-all rounded">
                                  {w}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-sm text-on-surface italic opacity-50 pt-1">&lt;empty&gt;</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Stack Debugger Overlay */}
                  {debugTarget && (
                     <StackDebugger />
                  )}

                  {/* Outputs */}
                  {analysis.outputs.map((output, i) => (
                    <div key={i} className="bg-black/60 backdrop-blur-md p-6 border-l-2 border-l-secondary border-y border-r border-white/10 rounded-r relative">
                      <div className="absolute top-4 right-4 flex gap-2">
                        <span className="font-mono text-[10px] font-bold tracking-widest border border-secondary text-secondary px-2 py-0.5 rounded bg-secondary/10 uppercase">{output.scriptType}</span>
                      </div>
                      <h2 className="font-mono text-[10px] font-bold tracking-widest text-on-surface-variant mb-4 uppercase">OUTPUT #{i}</h2>
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-4 items-baseline border-b border-white/5 pb-2">
                          <span className="font-mono text-xs text-surface-variant w-24">value</span>
                          <span className="font-mono text-sm text-on-surface">{output.valueBtc} <span className="text-surface-variant text-xs">BTC</span></span>
                        </div>
                        <div className="flex gap-4 items-baseline">
                          <span className="font-mono text-xs text-surface-variant w-24">address</span>
                          <span className="font-mono text-sm text-secondary break-all">{output.address || 'N/A'}</span>
                        </div>
                        <div className="flex gap-4 items-baseline">
                          <span className="font-mono text-xs text-surface-variant w-24">scriptPubKey</span>
                          <span className="font-mono text-sm text-on-surface-variant break-all">{output.scriptPubKeyAsm}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Panel */}
                <div className="w-full xl:w-[280px] flex flex-col gap-6 flex-shrink-0">
                  
                  {/* Opcodes Execution (Dynamic) */}
                  {debugSteps && debugSteps.length > 0 && (
                    <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded flex flex-col h-fit">
                      <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-mono text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">OPCODES EXECUTION</h3>
                        <span className="text-primary font-mono text-[10px]">{debugSteps.length} STEPS</span>
                      </div>
                      <div className="p-2 flex flex-col font-mono text-xs overflow-y-auto max-h-[300px]">
                        {debugSteps.map((step, idx) => (
                          <div key={idx} className={`flex justify-between items-center px-3 py-2 rounded ${step.error ? 'bg-error/10 text-error border border-error/50' : 'text-surface-variant hover:bg-white/5 border border-transparent'}`}>
                            <span className="opacity-50">{idx.toString().padStart(2, '0')}</span>
                            <span className={step.error ? 'font-bold' : ''}>{step.opcode}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Script Types Legend */}
                  <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded flex flex-col h-fit sticky top-[88px]">
                    <div className="p-4 border-b border-white/10">
                      <h3 className="font-mono text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">LEGEND</h3>
                    </div>
                    <div className="p-4 flex flex-col gap-3 font-mono text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm border border-tertiary bg-tertiary/10"></div>
                        <span className="text-on-surface">P2TR (Taproot)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm border border-secondary bg-secondary/10"></div>
                        <span className="text-on-surface">P2WPKH (SegWit)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm border border-[#f59e0b] bg-[#f59e0b]/10"></div>
                        <span className="text-on-surface">P2SH (Script Hash)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm border border-surface-variant bg-surface-variant/30"></div>
                        <span className="text-on-surface">P2PKH (Legacy)</span>
                      </div>
                    </div>
                  </div>

                  {/* Opcode Reference */}
                  <OpcodeRef />

                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </DigitalLoomBackground>
  );
}

export default function App() {
  return (
    <TxProvider>
      <AppContent />
    </TxProvider>
  );
}
