import { Buffer } from 'buffer';
import { crypto, opcodes as OPS, script, Transaction } from 'bitcoinjs-lib';
import { DebugStep } from './types';

const OPCODE_NAMES: Record<number, string> = Object.entries(OPS).reduce(
    (acc, [name, value]) => { acc[value as number] = name; return acc; },
    {} as Record<number, string>
);

function opcodeName(opcode: number): string {
    return OPCODE_NAMES[opcode] ?? `OP_UNKNOWN_${opcode}`;
}

// --- Script number encoding (BIP 62 compliant) ---

function decodeScriptNumber(buf: Buffer, maxLen = 4): number {
    if (buf.length === 0) return 0;
    if (buf.length > maxLen) throw new Error('Script number overflow');
    let result = 0;
    for (let i = 0; i < buf.length; i++) result |= buf[i] << (8 * i);
    if (buf[buf.length - 1] & 0x80) {
        return -(result & ~(0x80 << (8 * (buf.length - 1))));
    }
    return result;
}

function encodeScriptNumber(value: number): Buffer {
    if (value === 0) return Buffer.alloc(0);
    const neg = value < 0;
    let abs = Math.abs(value);
    const result: number[] = [];
    while (abs > 0) { result.push(abs & 0xff); abs >>= 8; }
    if (result[result.length - 1] & 0x80) result.push(neg ? 0x80 : 0x00);
    else if (neg) result[result.length - 1] |= 0x80;
    return Buffer.from(result);
}

function stackToHex(stack: Buffer[]): string[] {
    return stack.map(b => b.toString('hex'));
}

function pop(stack: Buffer[]): Buffer | null {
    return stack.length > 0 ? stack.pop()! : null;
}

function popNum(stack: Buffer[]): number | null {
    const buf = pop(stack);
    if (!buf) return null;
    try { return decodeScriptNumber(buf); } catch { return null; }
}

function peek(stack: Buffer[], offset = 0): Buffer | undefined {
    return stack[stack.length - 1 - offset];
}

// --- Sighash helper for real CHECKSIG ---

function tryVerifySig(
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
        let ecc: any;
        try { ecc = require('tiny-secp256k1'); } catch { return null; }
        return ecc.verify(hash, pubkey, sigDER);
    } catch {
        return null; // Can't compute — fall back to skipped
    }
}

// --- Main debugger ---

export function debugScriptExecution(params: {
    scriptSig: string;
    scriptPubKey: string;
    witness?: string[];
    rawTxHex?: string;
    inputIndex?: number;
}): DebugStep[] {
    const steps: DebugStep[] = [];
    const stack: Buffer[] = [];
    const altStack: Buffer[] = [];
    const ifStack: boolean[] = []; // tracks conditional execution
    let stepIndex = 0;

    const emit = (
        opcode: string, data: string | null,
        before: string[], error: DebugStep['error']
    ) => {
        steps.push({ stepIndex: stepIndex++, opcode, data, stackBefore: before, stackAfter: stackToHex(stack), error });
    };

    const executing = (): boolean => ifStack.every(v => v);

    // Push witness items
    if (params.witness && params.witness.length > 0) {
        for (const w of params.witness) {
            const before = stackToHex(stack);
            stack.push(Buffer.from(w, 'hex'));
            emit('WITNESS_PUSH', w, before, null);
        }
    }

    const scriptsToRun = [params.scriptSig, params.scriptPubKey]
        .map(h => Buffer.from(h, 'hex'))
        .filter(b => b.length > 0);

    for (const scriptBuf of scriptsToRun) {
        const chunks = script.decompile(scriptBuf) ?? [];

        for (const chunk of chunks) {
            const before = stackToHex(stack);
            let error: DebugStep['error'] = null;

            // --- Data push ---
            if (Buffer.isBuffer(chunk)) {
                if (executing()) stack.push(chunk);
                emit(`PUSHDATA_${chunk.length}`, chunk.toString('hex'), before, null);
                continue;
            }

            const name = opcodeName(chunk);

            // --- Flow control (always processed) ---
            if (chunk === OPS.OP_IF || chunk === OPS.OP_NOTIF) {
                if (executing()) {
                    const top = pop(stack);
                    if (!top) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                    const val = decodeScriptNumber(top) !== 0;
                    ifStack.push(chunk === OPS.OP_IF ? val : !val);
                } else {
                    ifStack.push(false);
                }
                emit(name, null, before, null);
                continue;
            }
            if (chunk === OPS.OP_ELSE) {
                if (ifStack.length === 0) { emit(name, null, before, 'VERIFY_FAILED'); return steps; }
                ifStack[ifStack.length - 1] = !ifStack[ifStack.length - 1];
                emit(name, null, before, null);
                continue;
            }
            if (chunk === OPS.OP_ENDIF) {
                if (ifStack.length === 0) { emit(name, null, before, 'VERIFY_FAILED'); return steps; }
                ifStack.pop();
                emit(name, null, before, null);
                continue;
            }

            // Skip everything else if not executing
            if (!executing()) { emit(name, null, before, null); continue; }

            // --- NOP family ---
            if (chunk === OPS.OP_NOP || (chunk >= 0xb1 && chunk <= 0xb9 && chunk !== OPS.OP_CHECKLOCKTIMEVERIFY && chunk !== OPS.OP_CHECKSEQUENCEVERIFY)) {
                emit(name, null, before, null); continue;
            }

            // --- OP_RETURN ---
            if (chunk === OPS.OP_RETURN) { emit(name, null, before, 'VERIFY_FAILED'); return steps; }

            // --- OP_VERIFY ---
            if (chunk === OPS.OP_VERIFY) {
                const top = pop(stack);
                if (!top) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                if (decodeScriptNumber(top) === 0) { emit(name, null, before, 'VERIFY_FAILED'); return steps; }
                emit(name, null, before, null); continue;
            }

            // --- Small integer push (OP_0 through OP_16) ---
            if (chunk >= OPS.OP_0 && chunk <= OPS.OP_16) {
                const val = chunk === OPS.OP_0 ? 0 : chunk - (OPS.OP_1 - 1);
                stack.push(encodeScriptNumber(val));
                emit(name, null, before, null); continue;
            }

            // --- OP_1NEGATE ---
            if (chunk === OPS.OP_1NEGATE) {
                stack.push(encodeScriptNumber(-1));
                emit(name, null, before, null); continue;
            }

            // === STACK MANIPULATION ===
            if (chunk === OPS.OP_DUP) {
                const t = peek(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(Buffer.from(t)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_2DUP) {
                if (stack.length < 2) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(Buffer.from(stack[stack.length - 2]), Buffer.from(stack[stack.length - 1]));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_3DUP) {
                if (stack.length < 3) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(Buffer.from(stack[stack.length - 3]), Buffer.from(stack[stack.length - 2]), Buffer.from(stack[stack.length - 1]));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_DROP) {
                if (!pop(stack)) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_2DROP) {
                if (stack.length < 2) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                pop(stack); pop(stack); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_NIP) {
                if (stack.length < 2) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.splice(stack.length - 2, 1); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_OVER) {
                if (stack.length < 2) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(Buffer.from(stack[stack.length - 2])); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_2OVER) {
                if (stack.length < 4) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(Buffer.from(stack[stack.length - 4]), Buffer.from(stack[stack.length - 3]));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_SWAP) {
                if (stack.length < 2) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const i = stack.length - 1;
                [stack[i], stack[i - 1]] = [stack[i - 1], stack[i]];
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_2SWAP) {
                if (stack.length < 4) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const l = stack.length;
                [stack[l-4], stack[l-2]] = [stack[l-2], stack[l-4]];
                [stack[l-3], stack[l-1]] = [stack[l-1], stack[l-3]];
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_ROT) {
                if (stack.length < 3) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const item = stack.splice(stack.length - 3, 1)[0];
                stack.push(item); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_2ROT) {
                if (stack.length < 6) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const items = stack.splice(stack.length - 6, 2);
                stack.push(...items); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_PICK) {
                const n = popNum(stack); if (n === null || n < 0 || n >= stack.length) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(Buffer.from(stack[stack.length - 1 - n])); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_ROLL) {
                const n = popNum(stack); if (n === null || n < 0 || n >= stack.length) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const item = stack.splice(stack.length - 1 - n, 1)[0];
                stack.push(item); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_TUCK) {
                if (stack.length < 2) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.splice(stack.length - 2, 0, Buffer.from(stack[stack.length - 1]));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_IFDUP) {
                const t = peek(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                if (decodeScriptNumber(t) !== 0) stack.push(Buffer.from(t));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_DEPTH) {
                stack.push(encodeScriptNumber(stack.length));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_SIZE) {
                const t = peek(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(t.length));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_TOALTSTACK) {
                const v = pop(stack); if (!v) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                altStack.push(v); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_FROMALTSTACK) {
                if (altStack.length === 0) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(altStack.pop()!); emit(name, null, before, null); continue;
            }

            // === ARITHMETIC ===
            if (chunk === OPS.OP_1ADD) {
                const a = popNum(stack); if (a === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(a + 1)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_1SUB) {
                const a = popNum(stack); if (a === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(a - 1)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_NEGATE) {
                const a = popNum(stack); if (a === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(-a)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_ABS) {
                const a = popNum(stack); if (a === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(Math.abs(a))); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_NOT) {
                const a = popNum(stack); if (a === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(a === 0 ? 1 : 0)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_0NOTEQUAL) {
                const a = popNum(stack); if (a === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(a !== 0 ? 1 : 0)); emit(name, null, before, null); continue;
            }
            // Binary arithmetic
            if ([OPS.OP_ADD, OPS.OP_SUB, OPS.OP_BOOLAND, OPS.OP_BOOLOR,
                 OPS.OP_NUMEQUAL, OPS.OP_NUMEQUALVERIFY, OPS.OP_NUMNOTEQUAL,
                 OPS.OP_LESSTHAN, OPS.OP_GREATERTHAN, OPS.OP_LESSTHANOREQUAL,
                 OPS.OP_GREATERTHANOREQUAL, OPS.OP_MIN, OPS.OP_MAX].includes(chunk)) {
                const b = popNum(stack); const a = popNum(stack);
                if (a === null || b === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                let r = 0;
                switch (chunk) {
                    case OPS.OP_ADD: r = a + b; break;
                    case OPS.OP_SUB: r = a - b; break;
                    case OPS.OP_BOOLAND: r = (a !== 0 && b !== 0) ? 1 : 0; break;
                    case OPS.OP_BOOLOR: r = (a !== 0 || b !== 0) ? 1 : 0; break;
                    case OPS.OP_NUMEQUAL: case OPS.OP_NUMEQUALVERIFY: r = a === b ? 1 : 0; break;
                    case OPS.OP_NUMNOTEQUAL: r = a !== b ? 1 : 0; break;
                    case OPS.OP_LESSTHAN: r = a < b ? 1 : 0; break;
                    case OPS.OP_GREATERTHAN: r = a > b ? 1 : 0; break;
                    case OPS.OP_LESSTHANOREQUAL: r = a <= b ? 1 : 0; break;
                    case OPS.OP_GREATERTHANOREQUAL: r = a >= b ? 1 : 0; break;
                    case OPS.OP_MIN: r = Math.min(a, b); break;
                    case OPS.OP_MAX: r = Math.max(a, b); break;
                }
                stack.push(encodeScriptNumber(r));
                if (chunk === OPS.OP_NUMEQUALVERIFY && r === 0) { emit(name, null, before, 'VERIFY_FAILED'); return steps; }
                if (chunk === OPS.OP_NUMEQUALVERIFY) pop(stack); // remove result on verify success
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_WITHIN) {
                const max = popNum(stack); const min = popNum(stack); const x = popNum(stack);
                if (x === null || min === null || max === null) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(encodeScriptNumber(x >= min && x < max ? 1 : 0));
                emit(name, null, before, null); continue;
            }

            // === CRYPTO ===
            if (chunk === OPS.OP_RIPEMD160) {
                const t = pop(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(crypto.ripemd160(t)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_SHA1) {
                const t = pop(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(crypto.sha1(t)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_SHA256) {
                const t = pop(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(crypto.sha256(t)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_HASH160) {
                const t = pop(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(crypto.hash160(t)); emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_HASH256) {
                const t = pop(stack); if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(crypto.hash256(t)); emit(name, null, before, null); continue;
            }

            // === EQUALITY ===
            if (chunk === OPS.OP_EQUAL) {
                const b = pop(stack); const a = pop(stack);
                if (!a || !b) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                stack.push(Buffer.from([a.equals(b) ? 1 : 0]));
                emit(name, null, before, null); continue;
            }
            if (chunk === OPS.OP_EQUALVERIFY) {
                const b = pop(stack); const a = pop(stack);
                if (!a || !b) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                if (!a.equals(b)) { emit(name, null, before, 'VERIFY_FAILED'); return steps; }
                emit(name, null, before, null); continue;
            }

            // === CHECKSIG (with optional real verification) ===
            if (chunk === OPS.OP_CHECKSIG) {
                const pubkey = pop(stack); const sig = pop(stack);
                if (!pubkey || !sig) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const verified = tryVerifySig(sig, pubkey, params.rawTxHex, params.inputIndex, params.scriptPubKey);
                if (verified === true) {
                    stack.push(Buffer.from([1]));
                    emit(name, null, before, null); continue;
                } else if (verified === false) {
                    stack.push(Buffer.from([0]));
                    emit(name, null, before, 'VERIFY_FAILED'); continue;
                }
                // Can't verify — assume true
                stack.push(Buffer.from([1]));
                emit(name, null, before, 'CHECKSIG_SKIPPED'); continue;
            }
            if (chunk === OPS.OP_CHECKSIGVERIFY) {
                const pubkey = pop(stack); const sig = pop(stack);
                if (!pubkey || !sig) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const verified = tryVerifySig(sig, pubkey, params.rawTxHex, params.inputIndex, params.scriptPubKey);
                if (verified === false) { emit(name, null, before, 'VERIFY_FAILED'); return steps; }
                if (verified === null) error = 'CHECKSIG_SKIPPED';
                emit(name, null, before, error); continue;
            }

            // === CHECKMULTISIG ===
            if (chunk === OPS.OP_CHECKMULTISIG || chunk === OPS.OP_CHECKMULTISIGVERIFY) {
                const nBuf = pop(stack);
                if (!nBuf) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const n = decodeScriptNumber(nBuf);
                if (n < 0 || n > 20 || stack.length < n) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                for (let i = 0; i < n; i++) pop(stack); // pubkeys
                const mBuf = pop(stack);
                if (!mBuf) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                const m = decodeScriptNumber(mBuf);
                if (m < 0 || m > n || stack.length < m) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                for (let i = 0; i < m; i++) pop(stack); // sigs
                pop(stack); // dummy element (off-by-one bug in Bitcoin)
                if (chunk === OPS.OP_CHECKMULTISIG) {
                    stack.push(Buffer.from([1]));
                    emit(name, null, before, 'CHECKSIG_SKIPPED'); continue;
                }
                // CHECKMULTISIGVERIFY
                emit(name, null, before, 'CHECKSIG_SKIPPED'); continue;
            }

            // === LOCKTIME (NOP-like — no tx context for validation) ===
            if (chunk === OPS.OP_CHECKLOCKTIMEVERIFY || chunk === OPS.OP_CHECKSEQUENCEVERIFY) {
                const t = peek(stack);
                if (!t) { emit(name, null, before, 'STACK_EMPTY'); return steps; }
                // In real Bitcoin these check against tx locktime/sequence but we lack that context
                emit(name, `(value: ${decodeScriptNumber(t)})`, before, null); continue;
            }

            // === OP_CODESEPARATOR ===
            if (chunk === OPS.OP_CODESEPARATOR) {
                emit(name, null, before, null); continue;
            }

            // === Unknown / unimplemented opcode — pass through ===
            emit(name, null, before, null);
        }
    }

    return steps;
}
