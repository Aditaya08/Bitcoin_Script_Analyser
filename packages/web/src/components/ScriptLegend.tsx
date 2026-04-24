import React, { useState } from 'react';
import { Info, Shield, Zap, Lock, Key, Hash, FileCode, Ban } from 'lucide-react';

interface ScriptEntry {
  type: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
  era: string;
}

const SCRIPT_TYPES: ScriptEntry[] = [
  {
    type: 'P2TR',
    label: 'Taproot',
    color: '#ffb689',
    bg: 'rgba(255,182,137,0.08)',
    border: 'rgba(255,182,137,0.25)',
    icon: <Zap className="w-3.5 h-3.5" />,
    description: 'Pay-to-Taproot — the latest Bitcoin script type, enabling Schnorr signatures and Merkelized script trees.',
    details: ['Schnorr signatures', 'MAST script trees', 'Key & script spend paths', 'BIP 341 / BIP 342'],
    era: '2021+',
  },
  {
    type: 'P2WPKH',
    label: 'SegWit v0',
    color: '#c8c3e1',
    bg: 'rgba(200,195,225,0.08)',
    border: 'rgba(200,195,225,0.25)',
    icon: <Shield className="w-3.5 h-3.5" />,
    description: 'Pay-to-Witness-Public-Key-Hash — segregated witness for single-key outputs.',
    details: ['Witness data separated', 'Reduced fees (~37%)', '20-byte pubkey hash', 'BIP 141 / BIP 143'],
    era: '2017+',
  },
  {
    type: 'P2WSH',
    label: 'SegWit Script',
    color: '#a5a7ff',
    bg: 'rgba(165,167,255,0.08)',
    border: 'rgba(165,167,255,0.25)',
    icon: <FileCode className="w-3.5 h-3.5" />,
    description: 'Pay-to-Witness-Script-Hash — SegWit version of P2SH for complex scripts.',
    details: ['Multisig, HTLCs, etc.', '32-byte script hash', 'Witness discount', 'BIP 141'],
    era: '2017+',
  },
  {
    type: 'P2SH',
    label: 'Script Hash',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.25)',
    icon: <Hash className="w-3.5 h-3.5" />,
    description: 'Pay-to-Script-Hash — enables complex spending conditions behind a hash.',
    details: ['Multisig support', 'Redeem script hidden', '20-byte hash', 'BIP 16'],
    era: '2012+',
  },
  {
    type: 'P2PKH',
    label: 'Legacy',
    color: '#888',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.1)',
    icon: <Key className="w-3.5 h-3.5" />,
    description: 'Pay-to-Public-Key-Hash — the original Bitcoin address format.',
    details: ['DUP HASH160 … EQUALVERIFY CHECKSIG', 'Addresses start with 1', 'ECDSA signatures', 'Since genesis'],
    era: '2009+',
  },
  {
    type: 'P2PK',
    label: 'Pay-to-PubKey',
    color: '#666',
    bg: 'rgba(255,255,255,0.02)',
    border: 'rgba(255,255,255,0.08)',
    icon: <Lock className="w-3.5 h-3.5" />,
    description: 'Pay-to-Public-Key — earliest script type, used in coinbase transactions.',
    details: ['Raw public key in output', 'No address format', 'Rarely used today', 'Genesis block era'],
    era: '2009',
  },
  {
    type: 'OP_RETURN',
    label: 'Data Carrier',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.2)',
    icon: <Ban className="w-3.5 h-3.5" />,
    description: 'OP_RETURN — provably unspendable output for embedding arbitrary data.',
    details: ['Max 80 bytes data', 'Ordinals / Runes', 'Prunable by nodes', 'BIP 141 null data'],
    era: '2014+',
  },
];

export function ScriptLegend() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded flex flex-col h-fit overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">Script Types</h3>
        <span className="font-mono text-[10px] text-primary">{SCRIPT_TYPES.length}</span>
      </div>

      <div className="flex flex-col">
        {SCRIPT_TYPES.map((entry) => {
          const isOpen = expanded === entry.type;

          return (
            <div key={entry.type}>
              <button
                onClick={() => setExpanded(isOpen ? null : entry.type)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-200 group"
                style={{
                  background: isOpen ? entry.bg : 'transparent',
                  borderLeft: isOpen ? `2px solid ${entry.color}` : '2px solid transparent',
                }}
              >
                {/* Color icon */}
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200"
                  style={{
                    background: entry.bg,
                    color: entry.color,
                    border: `1px solid ${entry.border}`,
                    transform: isOpen ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {entry.icon}
                </span>

                {/* Label & type */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium" style={{ color: isOpen ? '#fff' : '#ccc' }}>
                      {entry.type}
                    </span>
                    <span className="font-mono text-[9px] opacity-40">{entry.era}</span>
                  </div>
                  <span className="font-mono text-[10px] block truncate" style={{ color: entry.color, opacity: 0.7 }}>
                    {entry.label}
                  </span>
                </div>

                {/* Expand indicator */}
                <Info
                  className="w-3 h-3 flex-shrink-0 transition-all duration-200"
                  style={{
                    color: isOpen ? entry.color : '#444',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {/* Expandable detail panel */}
              {isOpen && (
                <div
                  className="px-4 pb-3 pt-1 ml-[26px] border-l-2"
                  style={{ borderLeftColor: entry.color + '40' }}
                >
                  <p className="font-mono text-[10px] leading-relaxed mb-2" style={{ color: '#aaa' }}>
                    {entry.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.details.map((d, i) => (
                      <span
                        key={i}
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                        style={{
                          background: entry.bg,
                          color: entry.color,
                          border: `1px solid ${entry.border}`,
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
