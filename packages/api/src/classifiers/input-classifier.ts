import { Buffer } from 'buffer';
import { ScriptType, WitnessType } from '../types';
import { classifyScript } from './script-classifier';
import { classifyWitness } from './witness-classifier';

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
