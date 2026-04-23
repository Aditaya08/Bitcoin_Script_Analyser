import { DebugStep, TxAnalysis } from '@/types';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(errorBody?.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getTxAnalysis(txid: string): Promise<TxAnalysis> {
  const response = await fetch(`/api/tx/${txid}`);
  return handleResponse<TxAnalysis>(response);
}

export async function debugScript(payload: {
  scriptSig: string;
  scriptPubKey: string;
  witness?: string[];
}): Promise<DebugStep[]> {
  const response = await fetch('/api/script/debug', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<DebugStep[]>(response);
}
