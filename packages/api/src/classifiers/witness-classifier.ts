import { Buffer } from 'buffer';
import { ScriptType, WitnessType } from '../types';
import { isPubkey } from '../utils/crypto-utils';
import { classifyScript } from './script-classifier';

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
