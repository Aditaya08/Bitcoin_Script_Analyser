import React, { useState } from 'react';
import { Copy, ChevronDown, FileText, Eye, Hash } from 'lucide-react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface WitnessItemProps {
  index: number;
  hex: string;
}

export function WitnessItem({ index, hex }: WitnessItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [copyFn] = useCopyToClipboard();
  
  const bytes = hex.length / 2;
  const isLong = hex.length > 32;
  
  // Simple heuristic to detect witness item type
  const getItemType = (h: string): string => {
    if (h.length === 0) return 'empty';
    if (h.length === 130 || h.length === 128) return 'signature (64-65 bytes)';
    if (h.length === 66 || h.length === 130) return 'pubkey (33/65 bytes)';
    if (h.length >= 66 && (h.length - 2) % 64 === 0) return 'control block';
    if (h.length > 100) return 'taproot script / data';
    return 'data';
  };
  
  const type = getItemType(hex);
  const displayHex = expanded || !isLong ? hex : hex.slice(0, 16) + '…' + hex.slice(-16);
  
  const handleCopy = async () => {
    try {
      await copyFn(hex);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 1500);
    }
  };
  
  return (
    <div className="group relative mb-2">
      <div 
        className="flex items-center gap-2 px-3 py-2 rounded-md font-mono text-[11px] cursor-pointer transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-20 opacity-50 flex-shrink-0 text-on-surface-variant">
          witness[{index}]:
        </span>
        <span 
          className="truncate flex-grow select-all"
          style={{ color: '#ccc' }}
          title={expanded ? 'Click to collapse' : 'Click to expand'}
        >
          {displayHex}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-on-surface-variant/60 border border-white/10 flex-shrink-0">
          {bytes} bytes
        </span>
        <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex-shrink-0 font-medium">
          {type}
        </span>
        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
            title="Copy full hex"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <span className="w-6 h-6 flex items-center justify-center text-on-surface-variant/50">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </div>
      
      {expanded && (
        <div className="ml-8 mt-1 p-3 rounded-md font-mono text-[10px] break-all relative"
          style={{
            background: 'rgba(18,20,20,0.97)',
            border: '1px solid rgba(129,131,255,0.2)',
            color: '#e2e2e2',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-medium text-on-surface-variant">Full witness data</span>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="w-5 h-5 rounded flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="select-all whitespace-pre-wrap word-break-break-all">
            {hex}
          </div>
        </div>
      )}
    </div>
  );
}