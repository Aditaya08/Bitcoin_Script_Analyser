import { Buffer } from 'buffer';
import { Transaction } from 'bitcoinjs-lib';

export function tryVerifySig(
    sig: Buffer, pubkey: Buffer, rawTxHex?: string, inputIndex?: number, prevScriptPubKey?: string
): boolean | null {
    if (!rawTxHex || inputIndex === undefined || !prevScriptPubKey) return null;
    try {
        const tx = Transaction.fromHex(rawTxHex);
        const hashType = sig[sig.length - 1];
        const sigDER = sig.slice(0, -1);
        const spk = Buffer.from(prevScriptPubKey, 'hex');

        // Legacy sighash
        const hash = tx.hashForSignature(inputIndex, spk, hashType);

        // Try to verify with secp256k1
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let ecc: any;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        try { ecc = require('tiny-secp256k1'); } catch { return null; }
        return ecc.verify(hash, pubkey, sigDER);
    } catch {
        return null; // Can't compute — fall back to skipped
    }
}
