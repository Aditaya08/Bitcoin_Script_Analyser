import { opcodes as OPS, script, Transaction } from 'bitcoinjs-lib';
import { TxFetcher } from '../src/fetcher';

describe('TxFetcher', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    function makeResponse(body: string, status = 200, contentType = 'text/plain'): Response {
        return new Response(body, {
            status,
            headers: {
                'content-type': contentType,
            },
        });
    }

    it('fetches transaction hex and returns structured analysis', async () => {
        const tx = new Transaction();
        tx.version = 2;

        tx.addInput(Buffer.alloc(32, 0x01), 0, 0xfffffffd, Buffer.alloc(0));
        tx.addOutput(script.compile([OPS.OP_0, Buffer.alloc(20, 0x22)]), 49000);

        const txHex = tx.toHex();
        const txid = tx.getId();

        const txJson = {
            fee: 1000,
            vin: [
                {
                    txid: 'ab'.repeat(32),
                    vout: 0,
                    prevout: {
                        scriptpubkey: script.compile([OPS.OP_1, Buffer.alloc(32, 0x11)]).toString('hex'),
                        scriptpubkey_asm: 'OP_1 <xonly>',
                        value: 50000,
                    },
                },
            ],
        };

        global.fetch = jest.fn().mockImplementation((url: string) => {
            if (url.includes('/hex')) {
                return Promise.resolve(makeResponse(txHex, 200, 'text/plain'));
            } else {
                return Promise.resolve(makeResponse(JSON.stringify(txJson), 200, 'application/json'));
            }
        }) as unknown as typeof fetch;

        const fetcher = new TxFetcher();
        const analysis = await fetcher.fetchTxAnalysis(txid);

        expect(analysis.txid).toBe(txid);
        expect(analysis.inputs).toHaveLength(1);
        expect(analysis.outputs).toHaveLength(1);
        expect(analysis.fee).toBe(1000);
        expect(analysis.inputs[0].scriptType).toBe('P2TR');
        expect(analysis.outputs[0].scriptType).toBe('P2WPKH');
    });

    it('falls back to secondary provider when primary provider fails', async () => {
        const tx = new Transaction();
        tx.version = 1;
        tx.addInput(Buffer.alloc(32, 0xaa), 1, 0xfffffffe, Buffer.alloc(0));
        tx.addOutput(script.compile([OPS.OP_RETURN, Buffer.from('test')]), 0);

        const txHex = tx.toHex();

        global.fetch = jest.fn().mockImplementation((url: string) => {
            if (url.includes('/hex')) {
                if (url.includes('mempool.space')) {
                    return Promise.resolve(makeResponse('not found', 404, 'text/plain'));
                }
                return Promise.resolve(makeResponse(txHex, 200, 'text/plain'));
            } else {
                return Promise.resolve(makeResponse('error', 500, 'text/plain'));
            }
        }) as unknown as typeof fetch;

        const fetcher = new TxFetcher();
        const analysis = await fetcher.fetchTxAnalysis(tx.getId());

        expect(analysis.txid).toBe(tx.getId());
        expect(analysis.outputs[0].scriptType).toBe('OP_RETURN');
    });
});
