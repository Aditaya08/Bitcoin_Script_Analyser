export function isTxid(value: string): boolean {
    return /^[0-9a-fA-F]{64}$/.test(value);
}

export function isHex(value: string): boolean {
    return /^[0-9a-fA-F]*$/.test(value);
}
