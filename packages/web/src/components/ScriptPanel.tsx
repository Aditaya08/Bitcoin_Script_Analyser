import React from 'react';
import { useTx } from '../context/TxContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScriptTypeTag } from './ScriptTypeTag';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

export function ScriptPanel() {
  const { analysis, setDebugTarget } = useTx();
  const [copy, isCopied] = useCopyToClipboard();

  if (!analysis) return null;

  return (
    <div className="mb-8">
      <Tabs defaultValue="inputs" className="w-full">
        <TabsList className="bg-transparent border-b border-white/20 rounded-none w-full justify-start h-auto p-0 space-x-6">
          <TabsTrigger value="inputs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-[12px] uppercase tracking-widest text-white/50 data-[state=active]:text-white">Inputs</TabsTrigger>
          <TabsTrigger value="outputs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-[12px] uppercase tracking-widest text-white/50 data-[state=active]:text-white">Outputs</TabsTrigger>
          <TabsTrigger value="raw" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-[12px] uppercase tracking-widest text-white/50 data-[state=active]:text-white">Raw JSON</TabsTrigger>
        </TabsList>
        
        <TabsContent value="inputs" className="mt-6 space-y-4">
          {analysis.inputs.map((input, i) => (
            <div key={i} className="border border-white/10 p-4 font-mono text-[12px] relative group overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/20 group-hover:bg-primary transition-colors"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <span className="opacity-50">#{input.index}</span>
                  <ScriptTypeTag scriptType={input.scriptType} />
                </div>
                {input.prevoutScriptPubKeyHex && (
                  <button 
                    onClick={() => setDebugTarget({ inputIndex: i, scriptSig: input.scriptSigHex, scriptPubKey: input.prevoutScriptPubKeyHex!, witness: input.witness })}
                    className="text-[11px] border border-white/20 px-2 py-1 hover:bg-white/10 transition-colors"
                  >
                    Debug →
                  </button>
                )}
              </div>
              
              <div className="space-y-2 opacity-80 cursor-pointer" onClick={() => copy(input.prevout)}>
                <div className="flex"><span className="w-24 opacity-50">prevout:</span><span className="truncate">{input.prevout}</span></div>
                <div className="flex"><span className="w-24 opacity-50">scriptSig:</span><span className="truncate">{input.scriptSigAsm || '(empty)'}</span></div>
                {input.witness.map((w, j) => (
                  <div key={j} className="flex"><span className="w-24 opacity-50">witness[{j}]:</span><span className="truncate">{w.substring(0, 16)}... ({w.length / 2} bytes)</span></div>
                ))}
                {input.taprootDetail && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-purple-300">
                    {input.taprootDetail.spendType === 'KEY_PATH' && 'Key-path spend · Schnorr sig (64 bytes)'}
                    {input.taprootDetail.spendType === 'SCRIPT_PATH' && `Script-path spend · Leaf: ${input.taprootDetail.leafScriptType}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </TabsContent>
        
        <TabsContent value="outputs" className="mt-6 space-y-4">
          {analysis.outputs.map((output, i) => (
            <div key={i} className="border border-white/10 p-4 font-mono text-[12px] relative group overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/20 group-hover:bg-primary transition-colors"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <span className="opacity-50">#{output.index}</span>
                  <ScriptTypeTag scriptType={output.scriptType} />
                </div>
                <div className="text-[14px]">{output.valueBtc} BTC</div>
              </div>
              
              <div className="space-y-2 opacity-80 cursor-pointer" onClick={() => copy(output.scriptPubKeyHex)}>
                <div className="flex"><span className="w-24 opacity-50">address:</span><span className="truncate text-green-300">{output.address || 'null'}</span></div>
                <div className="flex"><span className="w-24 opacity-50">scriptPubKey:</span><span className="truncate">{output.scriptPubKeyAsm}</span></div>
                
                {output.scriptType === 'OP_RETURN' && output.opReturnDecoded && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-gray-400">
                    <span className="opacity-50 mr-2">decoded:</span>
                    {output.opReturnDecoded}
                    {output.opReturnProtocol && <span className="ml-2 bg-gray-800 px-1 py-0.5 text-[10px] rounded">{output.opReturnProtocol}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </TabsContent>
        
        <TabsContent value="raw" className="mt-6">
          <div className="bg-black/50 p-4 border border-white/10 overflow-auto max-h-[400px]">
            <pre className="text-[11px] font-mono opacity-70">
              {JSON.stringify(analysis, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
