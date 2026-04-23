import React from 'react';
import { useTx } from '../context/TxContext';
import { Copy } from 'lucide-react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

export function TxOverview() {
  const { analysis, loading } = useTx();
  const [copy, isCopied] = useCopyToClipboard();

  if (loading) {
    return <div className="flex space-x-2 animate-pulse mb-8"><div className="h-8 bg-white/10 w-24"></div><div className="h-8 bg-white/10 w-16"></div></div>;
  }
  
  if (!analysis) return null;

  const metrics = [
    { label: 'TXID', value: analysis.txid.slice(0, 8) + '...' + analysis.txid.slice(-8), copyValue: analysis.txid },
    { label: 'SIZE', value: `${analysis.size} vB`, copyValue: analysis.size.toString() },
    { label: 'FEE', value: `${analysis.fee} sats`, copyValue: analysis.fee.toString() },
    { label: 'RATE', value: `${analysis.feerate} sat/vB`, copyValue: analysis.feerate.toString() },
    { label: 'VERSION', value: analysis.version, copyValue: analysis.version.toString() },
    { label: 'LOCKTIME', value: analysis.locktime, copyValue: analysis.locktime.toString() },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {metrics.map((m, i) => (
        <div key={i} className="flex items-center border border-white/10 px-2 py-1 cursor-pointer hover:border-white/30 transition-colors group relative" onClick={() => copy(m.copyValue)}>
          <span className="text-[11px] uppercase tracking-wider opacity-40 mr-2">{m.label}</span>
          <span className="text-[15px] font-mono">{m.value}</span>
          {m.label === 'TXID' && <Copy className="w-3 h-3 ml-2 opacity-50 group-hover:opacity-100" />}
          
          {/* Tooltip inline hack for copied state */}
          {isCopied && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-0.5 rounded border border-white/20 whitespace-nowrap z-50">✓ copied</div>}
        </div>
      ))}
    </div>
  );
}
