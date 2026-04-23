import { crypto, opcodes as OPS, script } from 'bitcoinjs-lib';
import { debugScriptExecution } from '../src/debugger';

describe('ScriptDebugger', () => {
    it('steps through a P2PKH-style script and marks checksig as skipped', () => {
        const pubkey = Buffer.concat([Buffer.from([0x02]), Buffer.alloc(32, 0x21)]);
        const signature = Buffer.from(
            '3045022100f4d4a7c4dd0fbe8ef0d40f1f8f0e78fa4ac89b1e42d6f95f8ff0f4e28a5da133022069078f4a96f487fe2e4b375e4b03c0f13c95bf9df4e2fc78c9ff5af4afb2a93f01',
            'hex'
        );

        const scriptSig = script.compile([signature, pubkey]).toString('hex');
        const scriptPubKey = script
            .compile([
                OPS.OP_DUP,
                OPS.OP_HASH160,
                crypto.hash160(pubkey),
                OPS.OP_EQUALVERIFY,
                OPS.OP_CHECKSIG,
            ])
            .toString('hex');

        const steps = debugScriptExecution({ scriptSig, scriptPubKey });

        expect(steps.length).toBeGreaterThan(0);
        expect(steps.some((step) => step.opcode === 'OP_DUP')).toBe(true);

        const checksigStep = steps.find((step) => step.opcode === 'OP_CHECKSIG');
        expect(checksigStep?.error).toBe('CHECKSIG_SKIPPED');
    });

    it('returns STACK_EMPTY when an opcode consumes from an empty stack', () => {
        const scriptPubKey = script.compile([OPS.OP_DUP]).toString('hex');
        const steps = debugScriptExecution({ scriptSig: '', scriptPubKey });

        expect(steps).toHaveLength(1);
        expect(steps[0].error).toBe('STACK_EMPTY');
    });

    it('returns VERIFY_FAILED when OP_EQUALVERIFY fails', () => {
        const scriptSig = script
            .compile([Buffer.from([0x01]), Buffer.from([0x02])])
            .toString('hex');
        const scriptPubKey = script.compile([OPS.OP_EQUALVERIFY]).toString('hex');

        const steps = debugScriptExecution({ scriptSig, scriptPubKey });

        expect(steps[steps.length - 1].opcode).toBe('OP_EQUALVERIFY');
        expect(steps[steps.length - 1].error).toBe('VERIFY_FAILED');
    });
});
