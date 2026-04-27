import { Buffer } from 'buffer';
import { opcodes as OPS, script } from 'bitcoinjs-lib';
import { ScriptClassification } from '../types';
import { asBuffer, isPubkey, safeUtf8Decode } from '../utils/crypto-utils';
import { isSmallIntegerOpcode, decodeSmallIntegerOpcode, scriptToAsm } from '../utils/script-utils';

const NONSTANDARD_CLASSIFICATION: ScriptClassification = {
    scriptType: 'NONSTANDARD',
    asm: '',
    m: null,
    n: null,
    opReturnHex: null,
    opReturnDecoded: null,
    opReturnProtocol: null,
};

function classifyMultisig(chunks: Array<number | Buffer>): {
    isMultisig: boolean;
    m: number | null;
    n: number | null;
} {
    if (chunks.length < 4) {
        return { isMultisig: false, m: null, n: null };
    }

    const first = chunks[0];
    const penultimate = chunks[chunks.length - 2];
    const last = chunks[chunks.length - 1];

    if (
        typeof first !== 'number' ||
        typeof penultimate !== 'number' ||
        typeof last !== 'number'
    ) {
        return { isMultisig: false, m: null, n: null };
    }

    if (last !== OPS.OP_CHECKMULTISIG) {
        return { isMultisig: false, m: null, n: null };
    }

    if (!isSmallIntegerOpcode(first) || !isSmallIntegerOpcode(penultimate)) {
        return { isMultisig: false, m: null, n: null };
    }

    const m = decodeSmallIntegerOpcode(first);
    const n = decodeSmallIntegerOpcode(penultimate);
    const pubkeys = chunks.slice(1, -2);

    if (pubkeys.length !== n || m > n || m === 0 || n === 0) {
        return { isMultisig: false, m: null, n: null };
    }

    if (!pubkeys.every((value) => Buffer.isBuffer(value) && isPubkey(value))) {
        return { isMultisig: false, m: null, n: null };
    }

    return { isMultisig: true, m, n };
}

export function classifyScript(scriptValue: Buffer | string): ScriptClassification {
    const scriptBytes = asBuffer(scriptValue);
    const chunks = script.decompile(scriptBytes);

    if (!chunks || chunks.length === 0) {
        return {
            ...NONSTANDARD_CLASSIFICATION,
            asm: scriptToAsm(scriptBytes),
        };
    }

    const asm = scriptToAsm(scriptBytes);

    const first = chunks[0];
    const second = chunks[1];
    const third = chunks[2];
    const fourth = chunks[3];
    const fifth = chunks[4];

    if (typeof first === 'number' && first === OPS.OP_RETURN) {
        let opReturnHex: string | null = null;
        let opReturnDecoded: string | null = null;
        let opReturnProtocol: 'ORDINALS_RUNES' | 'OMNI' | null = null;

        if (typeof second === 'number' && second === OPS.OP_13) {
            opReturnProtocol = 'ORDINALS_RUNES';
        }

        const pushedData = chunks.find((chunk, index) => index > 0 && Buffer.isBuffer(chunk));

        if (Buffer.isBuffer(pushedData)) {
            opReturnHex = pushedData.toString('hex');

            if (opReturnHex.startsWith('6f6d6e69')) {
                opReturnProtocol = 'OMNI';
            }

            opReturnDecoded = safeUtf8Decode(pushedData) ?? opReturnHex;
        }

        return {
            scriptType: 'OP_RETURN',
            asm,
            m: null,
            n: null,
            opReturnHex,
            opReturnDecoded,
            opReturnProtocol,
        };
    }

    if (
        chunks.length === 2 &&
        Buffer.isBuffer(first) &&
        isPubkey(first) &&
        typeof second === 'number' &&
        second === OPS.OP_CHECKSIG
    ) {
        return {
            scriptType: 'P2PK',
            asm,
            m: null,
            n: null,
            opReturnHex: null,
            opReturnDecoded: null,
            opReturnProtocol: null,
        };
    }

    if (
        chunks.length === 5 &&
        typeof first === 'number' &&
        first === OPS.OP_DUP &&
        typeof second === 'number' &&
        second === OPS.OP_HASH160 &&
        Buffer.isBuffer(third) &&
        third.length === 20 &&
        typeof fourth === 'number' &&
        fourth === OPS.OP_EQUALVERIFY &&
        typeof fifth === 'number' &&
        fifth === OPS.OP_CHECKSIG
    ) {
        return {
            scriptType: 'P2PKH',
            asm,
            m: null,
            n: null,
            opReturnHex: null,
            opReturnDecoded: null,
            opReturnProtocol: null,
        };
    }

    if (
        chunks.length === 3 &&
        typeof first === 'number' &&
        first === OPS.OP_HASH160 &&
        Buffer.isBuffer(second) &&
        second.length === 20 &&
        typeof third === 'number' &&
        third === OPS.OP_EQUAL
    ) {
        return {
            scriptType: 'P2SH',
            asm,
            m: null,
            n: null,
            opReturnHex: null,
            opReturnDecoded: null,
            opReturnProtocol: null,
        };
    }

    if (
        chunks.length === 2 &&
        typeof first === 'number' &&
        first === OPS.OP_0 &&
        Buffer.isBuffer(second) &&
        second.length === 20
    ) {
        return {
            scriptType: 'P2WPKH',
            asm,
            m: null,
            n: null,
            opReturnHex: null,
            opReturnDecoded: null,
            opReturnProtocol: null,
        };
    }

    if (
        chunks.length === 2 &&
        typeof first === 'number' &&
        first === OPS.OP_0 &&
        Buffer.isBuffer(second) &&
        second.length === 32
    ) {
        return {
            scriptType: 'P2WSH',
            asm,
            m: null,
            n: null,
            opReturnHex: null,
            opReturnDecoded: null,
            opReturnProtocol: null,
        };
    }

    if (
        chunks.length === 2 &&
        typeof first === 'number' &&
        first === OPS.OP_1 &&
        Buffer.isBuffer(second) &&
        second.length === 32
    ) {
        return {
            scriptType: 'P2TR',
            asm,
            m: null,
            n: null,
            opReturnHex: null,
            opReturnDecoded: null,
            opReturnProtocol: null,
        };
    }

    const multisig = classifyMultisig(chunks);
    if (multisig.isMultisig) {
        return {
            scriptType: 'P2MS',
            asm,
            m: multisig.m,
            n: multisig.n,
            opReturnHex: null,
            opReturnDecoded: null,
            opReturnProtocol: null,
        };
    }

    return {
        ...NONSTANDARD_CLASSIFICATION,
        asm,
    };
}
