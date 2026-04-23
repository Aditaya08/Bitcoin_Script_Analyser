import { opcodes as OPS, script } from 'bitcoinjs-lib';
import { classifyScript } from '../src/classifier';

describe('ScriptClassifier', () => {
    const pubkeyA = Buffer.concat([Buffer.from([0x02]), Buffer.alloc(32, 0x11)]);
    const pubkeyB = Buffer.concat([Buffer.from([0x03]), Buffer.alloc(32, 0x22)]);
    const pubkeyC = Buffer.concat([Buffer.from([0x02]), Buffer.alloc(32, 0x33)]);

    it.each([
        ['P2PK', script.compile([pubkeyA, OPS.OP_CHECKSIG])],
        [
            'P2PKH',
            script.compile([
                OPS.OP_DUP,
                OPS.OP_HASH160,
                Buffer.alloc(20, 0x01),
                OPS.OP_EQUALVERIFY,
                OPS.OP_CHECKSIG,
            ]),
        ],
        ['P2SH', script.compile([OPS.OP_HASH160, Buffer.alloc(20, 0x02), OPS.OP_EQUAL])],
        ['P2WPKH', script.compile([OPS.OP_0, Buffer.alloc(20, 0x03)])],
        ['P2WSH', script.compile([OPS.OP_0, Buffer.alloc(32, 0x04)])],
        ['P2TR', script.compile([OPS.OP_1, Buffer.alloc(32, 0x05)])],
        [
            'P2MS',
            script.compile([
                OPS.OP_2,
                pubkeyA,
                pubkeyB,
                pubkeyC,
                OPS.OP_3,
                OPS.OP_CHECKMULTISIG,
            ]),
        ],
        ['OP_RETURN', script.compile([OPS.OP_RETURN, Buffer.from('hello', 'utf8')])],
        ['NONSTANDARD', script.compile([OPS.OP_IF, OPS.OP_1, OPS.OP_ENDIF])],
    ])('classifies %s scripts', (expectedType, scriptBytes) => {
        const result = classifyScript(scriptBytes);
        expect(result.scriptType).toBe(expectedType);
    });

    it('extracts M-of-N for multisig scripts', () => {
        const scriptBytes = script.compile([
            OPS.OP_2,
            pubkeyA,
            pubkeyB,
            pubkeyC,
            OPS.OP_3,
            OPS.OP_CHECKMULTISIG,
        ]);

        const result = classifyScript(scriptBytes);

        expect(result.scriptType).toBe('P2MS');
        expect(result.m).toBe(2);
        expect(result.n).toBe(3);
    });

    it('detects OP_RETURN protocol prefixes', () => {
        const omniScript = script.compile([
            OPS.OP_RETURN,
            Buffer.from('6f6d6e6900000001', 'hex'),
        ]);

        const ordinalsScript = script.compile([
            OPS.OP_RETURN,
            OPS.OP_13,
            Buffer.from('00', 'hex'),
        ]);

        expect(classifyScript(omniScript).opReturnProtocol).toBe('OMNI');
        expect(classifyScript(ordinalsScript).opReturnProtocol).toBe('ORDINALS_RUNES');
    });
});
