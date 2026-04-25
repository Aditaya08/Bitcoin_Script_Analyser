import { opcodes as OPS, script } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

export const OPCODE_NAMES: Record<number, string> = Object.entries(OPS).reduce(
    (acc, [name, value]) => {
        acc[value as number] = name;
        return acc;
    },
    {} as Record<number, string>
);

export function opcodeName(opcode: number): string {
    return OPCODE_NAMES[opcode] ?? `OP_UNKNOWN_${opcode}`;
}

export function isSmallIntegerOpcode(opcode: number): boolean {
    return opcode >= OPS.OP_0 && opcode <= OPS.OP_16;
}

export function decodeSmallIntegerOpcode(opcode: number): number {
    if (opcode === OPS.OP_0) {
        return 0;
    }
    return opcode - (OPS.OP_1 - 1);
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
