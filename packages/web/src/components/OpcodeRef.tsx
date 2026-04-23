import React, { useState } from 'react';

const commonOpcodes = [
  { hex: '00', name: 'OP_0', effect: 'Pushes an empty array to the stack.' },
  { hex: '51', name: 'OP_1', effect: 'Pushes a 1 to the stack.' },
  { hex: '76', name: 'OP_DUP', effect: 'Duplicates the top stack item.' },
  { hex: '87', name: 'OP_EQUAL', effect: 'Returns 1 if the inputs are exactly equal, 0 otherwise.' },
  { hex: '88', name: 'OP_EQUALVERIFY', effect: 'Same as OP_EQUAL, but runs OP_VERIFY afterward.' },
  { hex: 'a8', name: 'OP_SHA256', effect: 'Hashes top stack item with SHA-256.' },
  { hex: 'a9', name: 'OP_HASH160', effect: 'Hashes top stack item with RIPEMD-160(SHA-256(x)).' },
  { hex: 'ac', name: 'OP_CHECKSIG', effect: 'Verifies the signature matches the pubkey and transaction.' },
  { hex: 'ae', name: 'OP_CHECKMULTISIG', effect: 'Verifies a multisignature.' },
  { hex: '6a', name: 'OP_RETURN', effect: 'Marks transaction as invalid. Used to store arbitrary data.' },
];

export function OpcodeRef() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded flex flex-col h-fit">
      <div 
        className="p-4 border-b border-white/10 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="font-mono text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">OPCODES REFERENCE</h3>
        <span className="text-on-surface-variant font-mono">{isOpen ? '−' : '+'}</span>
      </div>
      
      {isOpen && (
        <div className="p-0 overflow-hidden">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-white/5 text-surface-variant">
                <th className="p-3 border-b border-white/10 font-normal">Hex</th>
                <th className="p-3 border-b border-white/10 font-normal">Name</th>
                <th className="p-3 border-b border-white/10 font-normal">Effect</th>
              </tr>
            </thead>
            <tbody>
              {commonOpcodes.map((op, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group">
                  <td className="p-3 text-surface-variant group-hover:text-on-surface-variant transition-colors">0x{op.hex}</td>
                  <td className="p-3 text-primary-fixed group-hover:text-primary transition-colors">{op.name}</td>
                  <td className="p-3 text-on-surface-variant max-w-[120px] truncate" title={op.effect}>{op.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
