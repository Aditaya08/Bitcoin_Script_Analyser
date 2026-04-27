import { Buffer } from 'buffer';
import { classifyScript } from './classifiers/script-classifier';
import { scriptToAsm } from './utils/script-utils';
import { TaprootDetail } from './types';

function isSchnorrSignature(data: Buffer): boolean {
    return data.length === 64 || data.length === 65;
}

function isControlBlock(data: Buffer): boolean {
    return data.length >= 33 && (data.length - 33) % 32 === 0;
}

export function parseTaprootWitness(witnessHex: string[]): TaprootDetail | null {
    if (!witnessHex || witnessHex.length === 0) {
        return null;
    }

    const witness = witnessHex.map((item) => Buffer.from(item, 'hex'));

    if (witness.length === 1 && isSchnorrSignature(witness[0])) {
        return {
            spendType: 'KEY_PATH',
            schnorrSig: witness[0].toString('hex'),
            internalKey: null,
            controlBlock: null,
            controlBlockDepth: null,
            leafScriptHex: null,
            leafScriptAsm: null,
            leafScriptType: null,
        };
    }

    if (witness.length > 1) {
        const controlBlock = witness[witness.length - 1];

        if (!isControlBlock(controlBlock)) {
            return null;
        }

        const leafScript = witness[witness.length - 2];
        const internalKey = controlBlock.slice(1, 33);
        const depth = Math.max((controlBlock.length - 33) / 32, 0);
        const leafClassification = classifyScript(leafScript);

        return {
            spendType: 'SCRIPT_PATH',
            schnorrSig: null,
            internalKey: internalKey.toString('hex'),
            controlBlock: controlBlock.toString('hex'),
            controlBlockDepth: depth,
            leafScriptHex: leafScript.toString('hex'),
            leafScriptAsm: scriptToAsm(leafScript),
            leafScriptType: leafClassification.scriptType,
        };
    }

    return null;
}
