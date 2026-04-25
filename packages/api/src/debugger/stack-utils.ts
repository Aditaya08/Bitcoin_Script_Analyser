import { Buffer } from 'buffer';
import { decodeScriptNumber } from './script-number';

export function stackToHex(stack: Buffer[]): string[] {
    return stack.map(b => b.toString('hex'));
}

export function pop(stack: Buffer[]): Buffer | null {
    return stack.length > 0 ? stack.pop()! : null;
}

export function popNum(stack: Buffer[]): number | null {
    const buf = pop(stack);
    if (!buf) return null;
    try { return decodeScriptNumber(buf); } catch { return null; }
}

export function peek(stack: Buffer[], offset = 0): Buffer | undefined {
    return stack[stack.length - 1 - offset];
}
