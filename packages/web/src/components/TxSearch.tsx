import React, { useState } from 'react';
import { useTx } from '../context/TxContext';
import { Search, ArrowRight } from 'lucide-react';

export function TxSearch() {
  const [val, setVal] = useState('');
  const { fetchTx, loading, error } = useTx();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (val.trim()) {
      fetchTx(val.trim());
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-3xl">
      <form onSubmit={handleSearch} className={`bg-black/60 backdrop-blur-md rounded-full p-2 flex items-center gap-4 w-full border transition-all ${error ? 'border-error shadow-[0_0_8px_rgba(255,180,171,0.3)]' : 'border-white/10 focus-within:border-primary-container focus-within:shadow-[0_0_8px_rgba(129,131,255,0.3)]'}`}>
        <Search className="w-5 h-5 text-on-surface-variant ml-3 flex-shrink-0" />
        <input 
          className="bg-transparent border-none outline-none text-on-surface font-mono text-sm flex-grow focus:ring-0 placeholder:text-surface-variant min-w-0" 
          placeholder="Enter TXID..." 
          type="text" 
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button 
          type="submit" 
          disabled={loading}
          className="flex-shrink-0 bg-primary-container/20 border border-primary-container/50 text-primary-fixed px-4 py-1.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-primary-container/40 transition-colors disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Analyze'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>
      {error && <span className="text-error font-mono text-xs ml-4">{error}</span>}
    </div>
  );
}
