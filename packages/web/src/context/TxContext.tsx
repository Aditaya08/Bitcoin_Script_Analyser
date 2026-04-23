import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TxAnalysis, DebugStep } from '../types';

interface TxContextProps {
  txid: string;
  setTxid: (txid: string) => void;
  analysis: TxAnalysis | null;
  loading: boolean;
  error: string | null;
  fetchTx: (id: string) => Promise<void>;
  
  // Debugger state
  debugTarget: { inputIndex: number; scriptSig: string; scriptPubKey: string; witness: string[] } | null;
  setDebugTarget: (target: { inputIndex: number; scriptSig: string; scriptPubKey: string; witness: string[] } | null) => void;
  debugSteps: DebugStep[] | null;
  debugLoading: boolean;
  fetchDebug: (scriptSig: string, scriptPubKey: string, witness?: string[]) => Promise<void>;
}

const TxContext = createContext<TxContextProps | undefined>(undefined);

export const TxProvider = ({ children }: { children: ReactNode }) => {
  const [txid, setTxid] = useState('');
  const [analysis, setAnalysis] = useState<TxAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [debugTarget, setDebugTarget] = useState<{ inputIndex: number; scriptSig: string; scriptPubKey: string; witness: string[] } | null>(null);
  const [debugSteps, setDebugSteps] = useState<DebugStep[] | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  const fetchTx = async (id: string) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setDebugTarget(null);
    try {
      // Assuming api runs on port 4000
      const res = await fetch(`http://localhost:4000/api/tx/${id}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setAnalysis(data);
      setTxid(id);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transaction');
    } finally {
      setLoading(false);
    }
  };

  const fetchDebug = async (scriptSig: string, scriptPubKey: string, witness: string[] = []) => {
    setDebugLoading(true);
    setDebugSteps(null);
    try {
      const res = await fetch(`http://localhost:4000/api/script/debug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptSig, scriptPubKey, witness })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDebugSteps(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDebugLoading(false);
    }
  };

  return (
    <TxContext.Provider value={{
      txid, setTxid, analysis, loading, error, fetchTx,
      debugTarget, setDebugTarget, debugSteps, debugLoading, fetchDebug
    }}>
      {children}
    </TxContext.Provider>
  );
};

export const useTx = () => {
  const ctx = useContext(TxContext);
  if (!ctx) throw new Error('useTx must be used within TxProvider');
  return ctx;
};
