import init, {
  wasm_classify_script,
  wasm_debug_script,
  wasm_analyze_taproot,
} from '../wasm/btc-core/btc_core.js';

let initialized = false;

export async function initWasm() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export function classifyScript(scriptHex: string): any {
  return wasm_classify_script(scriptHex);
}

export function debugScript(
  scriptSig: string,
  scriptPubKey: string,
  witness: string[],
  rawTxHex?: string,
  inputIndex?: number,
  prevoutValue?: number,
  prevouts?: { scriptPubKey: string; value: number }[]
): any {
  return wasm_debug_script(
    scriptSig,
    scriptPubKey,
    witness,
    rawTxHex,
    inputIndex,
    prevoutValue !== undefined && prevoutValue !== null ? BigInt(prevoutValue) : undefined,
    prevouts
  );
}

export function analyzeTaproot(witness: string[]): any {
  return wasm_analyze_taproot(witness);
}
