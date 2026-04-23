import { opcodes as OPS, script } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import {
    ScriptClassification,
    ScriptType,
    WitnessType,
} from './types';

const OPCODE_NAMES: Record<number, string> = Object.entries(OPS).reduce(
    (acc, [name, value]) => {
        acc[value as number] = name;
        return acc;
    },
    {} as Record<number, string>
);

const NONSTANDARD_CLASSIFICATION: ScriptClassification = {
    scriptType: 'NONSTANDARD',
    asm: '',
    m: null,
    n: null,
    opReturnHex: null,
    opReturnDecoded: null,
    opReturnProtocol: null,
};

function asBuffer(value: Buffer | string): Buffer {
    if (Buffer.isBuffer(value)) {
        return value;
    }

    return Buffer.from(value, 'hex');
}

function isPubkey(data: Buffer): boolean {
    return data.length === 33 || data.length === 65;
}

function isSmallIntegerOpcode(opcode: number): boolean {
    return opcode >= OPS.OP_0 && opcode <= OPS.OP_16;
}

function decodeSmallIntegerOpcode(opcode: number): number {
    if (opcode === OPS.OP_0) {
        return 0;
    }

    return opcode - (OPS.OP_1 - 1);
}

function opcodeName(opcode: number): string {
    return OPCODE_NAMES[opcode] ?? `OP_${opcode}`;
}

function safeUtf8Decode(data: Buffer): string | null {
    if (data.length === 0) {
        return '';
    }

    const text = data.toString('utf8');
    const normalized = Buffer.from(text, 'utf8');

    if (!normalized.equals(data)) {
        return null;
    }

    if (!/^[\x09\x0A\x0D\x20-\x7E]+$/.test(text)) {
        return null;
    }

    return text;
}

export function scriptToAsm(scriptBytes: Buffer): string {
    const chunks = script.decompile(scriptBytes);

    if (!chunks || chunks.length === 0) {
        return '';
    }

    return chunks
        .map((chunk) => {
            if (Buffer.isBuffer(chunk)) {
                return chunk.toString('hex');
            }

            return opcodeName(chunk);
        })
        .join(' ');
}

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

function isLikelyDerSignature(data: Buffer): boolean {
    return data.length > 8 && data[0] === 0x30;
}

function isLikelySchnorrSignature(data: Buffer): boolean {
    return data.length === 64 || data.length === 65;
}

function isLikelyControlBlock(data: Buffer): boolean {
    return data.length >= 33 && (data.length - 33) % 32 === 0;
}

export function classifyWitness(
    witnessHex: string[]
): {
    witnessType: WitnessType | null;
    scriptType: ScriptType;
} {
    if (witnessHex.length === 0) {
        return {
            witnessType: null,
            scriptType: 'NONSTANDARD',
        };
    }

    const witness = witnessHex.map((item) => Buffer.from(item, 'hex'));

    if (witness.length === 1 && isLikelySchnorrSignature(witness[0])) {
        return {
            witnessType: 'P2TR_KEY_PATH',
            scriptType: 'P2TR',
        };
    }

    if (witness.length > 1 && isLikelyControlBlock(witness[witness.length - 1])) {
        return {
            witnessType: 'P2TR_SCRIPT_PATH',
            scriptType: 'P2TR',
        };
    }

    if (
        witness.length === 2 &&
        isLikelyDerSignature(witness[0]) &&
        isPubkey(witness[1])
    ) {
        return {
            witnessType: 'P2WPKH',
            scriptType: 'P2WPKH',
        };
    }

    const last = witness[witness.length - 1];
    const leaf = classifyScript(last);

    if (leaf.scriptType !== 'NONSTANDARD') {
        return {
            witnessType: 'P2WSH',
            scriptType: 'P2WSH',
        };
    }

    return {
        witnessType: 'UNKNOWN',
        scriptType: 'NONSTANDARD',
    };
}

export function classifyInputScript(
    scriptSigHex: string,
    witnessHex: string[]
): {
    scriptType: ScriptType;
    witnessType: WitnessType | null;
} {
    const scriptSigBuffer = Buffer.from(scriptSigHex, 'hex');
    const scriptSigClassification = classifyScript(scriptSigBuffer);

    if (witnessHex.length === 0) {
        return {
            scriptType: scriptSigClassification.scriptType,
            witnessType: null,
        };
    }

    const witnessClassification = classifyWitness(witnessHex);

    if (witnessClassification.scriptType !== 'NONSTANDARD') {
        return {
            scriptType: witnessClassification.scriptType,
            witnessType: witnessClassification.witnessType,
        };
    }

    return {
        scriptType: scriptSigClassification.scriptType,
        witnessType: witnessClassification.witnessType,
    };
}
