import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

const commonOpcodes = [
  { hex: '00', name: 'OP_0', category: 'push', effect: 'Pushes an empty array (falsy) to the stack.' },
  { hex: '51', name: 'OP_1', category: 'push', effect: 'Pushes the number 1 to the stack.' },
  { hex: '60', name: 'OP_16', category: 'push', effect: 'Pushes the number 16 to the stack.' },
  { hex: '4f', name: 'OP_1NEGATE', category: 'push', effect: 'Pushes -1 to the stack.' },
  { hex: '76', name: 'OP_DUP', category: 'stack', effect: 'Duplicates the top stack item.' },
  { hex: '6b', name: 'OP_TOALTSTACK', category: 'stack', effect: 'Moves top item to the alt stack.' },
  { hex: '6c', name: 'OP_FROMALTSTACK', category: 'stack', effect: 'Moves top alt stack item to main stack.' },
  { hex: '7c', name: 'OP_SWAP', category: 'stack', effect: 'Swaps the top two stack items.' },
  { hex: '75', name: 'OP_DROP', category: 'stack', effect: 'Removes the top stack item.' },
  { hex: '78', name: 'OP_OVER', category: 'stack', effect: 'Copies the second-to-top item to top.' },
  { hex: '93', name: 'OP_ADD', category: 'arith', effect: 'Pops two items, pushes their sum.' },
  { hex: '94', name: 'OP_SUB', category: 'arith', effect: 'Pops a, b; pushes b minus a.' },
  { hex: '87', name: 'OP_EQUAL', category: 'verify', effect: 'Returns 1 if inputs are exactly equal, 0 otherwise.' },
  { hex: '88', name: 'OP_EQUALVERIFY', category: 'verify', effect: 'Same as OP_EQUAL, but aborts if false.' },
  { hex: 'a8', name: 'OP_SHA256', category: 'crypto', effect: 'Hashes top stack item with SHA-256.' },
  { hex: 'a9', name: 'OP_HASH160', category: 'crypto', effect: 'Hashes top item with RIPEMD-160(SHA-256(x)).' },
  { hex: 'aa', name: 'OP_HASH256', category: 'crypto', effect: 'Double SHA-256 hash of top item.' },
  { hex: 'ac', name: 'OP_CHECKSIG', category: 'crypto', effect: 'Verifies signature against pubkey and transaction.' },
  { hex: 'ae', name: 'OP_CHECKMULTISIG', category: 'crypto', effect: 'Verifies m-of-n multisignature.' },
  { hex: '63', name: 'OP_IF', category: 'flow', effect: 'Executes following statements if top is truthy.' },
  { hex: '64', name: 'OP_NOTIF', category: 'flow', effect: 'Executes following statements if top is falsy.' },
  { hex: '67', name: 'OP_ELSE', category: 'flow', effect: 'Executes if the preceding OP_IF was not executed.' },
  { hex: '68', name: 'OP_ENDIF', category: 'flow', effect: 'Ends an if/else block.' },
  { hex: '69', name: 'OP_VERIFY', category: 'verify', effect: 'Marks transaction as invalid if top is falsy.' },
  { hex: '6a', name: 'OP_RETURN', category: 'verify', effect: 'Marks output as provably unspendable.' },
  { hex: 'b1', name: 'OP_CHECKLOCKTIMEVERIFY', category: 'flow', effect: 'Marks tx invalid if locktime is not reached.' },
  { hex: 'b2', name: 'OP_CHECKSEQUENCEVERIFY', category: 'flow', effect: 'Marks tx invalid if relative locktime not met.' },
];

const CATEGORY_COLORS: Record<string, string> = {
  push: '#a5a7ff',
  stack: '#4ade80',
  crypto: '#fbbf24',
  arith: '#60a5fa',
  flow: '#c084fc',
  verify: '#ffb689',
};

export function OpcodeRef() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = ['push', 'stack', 'arith', 'crypto', 'flow', 'verify'];

  const filtered = commonOpcodes.filter(op => {
    const matchesText = !filter || op.name.toLowerCase().includes(filter.toLowerCase()) || op.effect.toLowerCase().includes(filter.toLowerCase());
    const matchesCat = !activeCategory || op.category === activeCategory;
    return matchesText && matchesCat;
  });

  return (
    <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded flex flex-col h-fit">
      <div 
        className="p-4 border-b border-white/10 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="font-mono text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
          Opcodes Reference
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-primary">{commonOpcodes.length}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-on-surface-variant" /> : <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />}
        </div>
      </div>
      
      {isOpen && (
        <div className="flex flex-col">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-2 py-1.5">
              <Search className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter opcodes..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-transparent font-mono text-[11px] text-on-surface outline-none w-full placeholder:text-on-surface-variant/40"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className="font-mono text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider transition-all"
                  style={{
                    background: activeCategory === cat ? CATEGORY_COLORS[cat] + '20' : 'transparent',
                    color: activeCategory === cat ? CATEGORY_COLORS[cat] : '#666',
                    border: `1px solid ${activeCategory === cat ? CATEGORY_COLORS[cat] + '40' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Opcode List */}
          <div className="overflow-y-auto max-h-[400px] scroll-fade">
            {filtered.length === 0 ? (
              <div className="p-4 text-center font-mono text-[10px] text-on-surface-variant/50 italic">
                No matching opcodes
              </div>
            ) : (
              filtered.map((op, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Hex badge */}
                  <span className="font-mono text-[10px] text-on-surface-variant/50 pt-0.5 w-8 flex-shrink-0 tabular-nums">
                    0x{op.hex}
                  </span>
                  {/* Category dot + Name */}
                  <div className="flex items-center gap-1.5 w-[120px] flex-shrink-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: CATEGORY_COLORS[op.category] ?? '#555' }}
                    />
                    <span
                      className="font-mono text-[11px] font-medium group-hover:text-white transition-colors truncate"
                      style={{ color: CATEGORY_COLORS[op.category] ?? '#aaa' }}
                    >
                      {op.name}
                    </span>
                  </div>
                  {/* Effect */}
                  <span className="font-mono text-[10px] text-on-surface-variant/70 leading-relaxed">
                    {op.effect}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
