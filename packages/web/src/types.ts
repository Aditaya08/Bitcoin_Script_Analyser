export type ScriptType =
  | 'P2PK'
  | 'P2PKH'
  | 'P2SH'
  | 'P2WPKH'
  | 'P2WSH'
  | 'P2TR'
  | 'P2MS'
  | 'OP_RETURN'
  | 'NONSTANDARD';

export type WitnessType =
  | 'P2WPKH'
  | 'P2WSH'
  | 'P2TR_KEY_PATH'
  | 'P2TR_SCRIPT_PATH'
  | 'UNKNOWN';

export interface TaprootDetail {
  spendType: 'KEY_PATH' | 'SCRIPT_PATH';
  schnorrSig: string | null;
  internalKey: string | null;
  controlBlock: string | null;
  controlBlockDepth: number | null;
  leafScriptHex: string | null;
  leafScriptAsm: string | null;
  leafScriptType: ScriptType | null;
}

export interface InputAnalysis {
  index: number;
  prevout: string;
  sequence: number;
  scriptSigHex: string;
  scriptSigAsm: string;
  witness: string[];
  scriptType: ScriptType;
  witnessType: WitnessType | null;
  taprootDetail?: TaprootDetail;
  prevoutScriptPubKeyHex?: string;
  prevoutScriptPubKeyAsm?: string;
  prevoutValueSats?: number;
}

export interface OutputAnalysis {
  index: number;
  valuesSats: number;
  valueBtc: string;
  scriptPubKeyHex: string;
  scriptPubKeyAsm: string;
  scriptType: ScriptType;
  address: string | null;
  opReturnDecoded?: string;
  opReturnProtocol?: 'ORDINALS_RUNES' | 'OMNI' | null;
}

export interface TxAnalysis {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  vsize: number;
  weight: number;
  fee: number;
  feerate: number;
  inputs: InputAnalysis[];
  outputs: OutputAnalysis[];
}

export interface DebugStep {
  stepIndex: number;
  opcode: string;
  data: string | null;
  stackBefore: string[];
  stackAfter: string[];
  error: 'STACK_EMPTY' | 'VERIFY_FAILED' | 'CHECKSIG_SKIPPED' | null;
}
