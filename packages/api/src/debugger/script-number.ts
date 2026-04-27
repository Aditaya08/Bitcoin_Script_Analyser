import { Buffer } from 'buffer';

export function decodeScriptNumber(buf: Buffer, maxLen = 4): number {
    if (buf.length === 0) return 0;
    if (buf.length > maxLen) throw new Error('Script number overflow');
    let result = 0;
    for (let i = 0; i < buf.length; i++) result |= buf[i] << (8 * i);
    if (buf[buf.length - 1] & 0x80) {
        return -(result & ~(0x80 << (8 * (buf.length - 1))));
    }
    return result;
}

export function encodeScriptNumber(value: number): Buffer {
    if (value === 0) return Buffer.alloc(0);
    const neg = value < 0;
    let abs = Math.abs(value);
    const result: number[] = [];
    while (abs > 0) { result.push(abs & 0xff); abs >>= 8; }
    if (result[result.length - 1] & 0x80) result.push(neg ? 0x80 : 0x00);
    else if (neg) result[result.length - 1] |= 0x80;
    return Buffer.from(result);
}
