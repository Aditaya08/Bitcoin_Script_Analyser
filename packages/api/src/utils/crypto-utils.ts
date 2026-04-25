import { Buffer } from 'buffer';

export function asBuffer(value: Buffer | string): Buffer {
    if (Buffer.isBuffer(value)) {
        return value;
    }
    return Buffer.from(value, 'hex');
}

export function isPubkey(data: Buffer): boolean {
    return data.length === 33 || data.length === 65;
}

export function safeUtf8Decode(data: Buffer): string | null {
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
