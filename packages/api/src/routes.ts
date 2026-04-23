import { Router } from 'express';
import { classifyScript, scriptToAsm } from './classifier';
import { debugScriptExecution } from './debugger';
import { TxFetcher } from './fetcher';

function isTxid(value: string): boolean {
    return /^[0-9a-fA-F]{64}$/.test(value);
}

function isHex(value: string): boolean {
    return /^[0-9a-fA-F]*$/.test(value);
}

export function createApiRouter(fetcher: TxFetcher = new TxFetcher()): Router {
    const router = Router();

    router.get('/api/tx/:txid', async (req, res) => {
        try {
            const { txid } = req.params;
            if (!isTxid(txid)) {
                return res.status(400).json({ error: 'Invalid txid format' });
            }

            const analysis = await fetcher.fetchTxAnalysis(txid);
            return res.json(analysis);
        } catch (error) {
            return res.status(502).json({
                error: error instanceof Error ? error.message : 'Failed to fetch transaction',
            });
        }
    });

    router.get('/api/tx/:txid/input/:index', async (req, res) => {
        try {
            const { txid } = req.params;
            const index = Number(req.params.index);

            if (!isTxid(txid)) {
                return res.status(400).json({ error: 'Invalid txid format' });
            }

            if (!Number.isInteger(index) || index < 0) {
                return res.status(400).json({ error: 'Input index must be a positive integer' });
            }

            const analysis = await fetcher.fetchTxAnalysis(txid);
            const input = analysis.inputs[index];

            if (!input) {
                return res.status(404).json({ error: 'Input not found' });
            }

            return res.json(input);
        } catch (error) {
            return res.status(502).json({
                error: error instanceof Error ? error.message : 'Failed to fetch input',
            });
        }
    });

    router.get('/api/tx/:txid/output/:index', async (req, res) => {
        try {
            const { txid } = req.params;
            const index = Number(req.params.index);

            if (!isTxid(txid)) {
                return res.status(400).json({ error: 'Invalid txid format' });
            }

            if (!Number.isInteger(index) || index < 0) {
                return res.status(400).json({ error: 'Output index must be a positive integer' });
            }

            const analysis = await fetcher.fetchTxAnalysis(txid);
            const output = analysis.outputs[index];

            if (!output) {
                return res.status(404).json({ error: 'Output not found' });
            }

            return res.json(output);
        } catch (error) {
            return res.status(502).json({
                error: error instanceof Error ? error.message : 'Failed to fetch output',
            });
        }
    });

    router.post('/api/script/classify', (req, res) => {
        const { hex } = req.body as { hex?: string };

        if (!hex || typeof hex !== 'string' || !isHex(hex)) {
            return res.status(400).json({ error: 'Body must include a valid hex string' });
        }

        const scriptBuffer = Buffer.from(hex, 'hex');
        const classification = classifyScript(scriptBuffer);

        return res.json({
            scriptType: classification.scriptType,
            asm: classification.asm || scriptToAsm(scriptBuffer),
            m: classification.m,
            n: classification.n,
            opReturnHex: classification.opReturnHex,
            opReturnDecoded: classification.opReturnDecoded,
            opReturnProtocol: classification.opReturnProtocol,
        });
    });

    router.post('/api/script/debug', (req, res) => {
        const body = req.body as {
            scriptSig?: string;
            scriptPubKey?: string;
            witness?: string[];
            rawTxHex?: string;
            inputIndex?: number;
        };

        if (
            typeof body.scriptSig !== 'string' ||
            typeof body.scriptPubKey !== 'string' ||
            !isHex(body.scriptSig) ||
            !isHex(body.scriptPubKey)
        ) {
            return res.status(400).json({
                error: 'Body must include scriptSig and scriptPubKey hex strings',
            });
        }

        if (
            body.witness &&
            (!Array.isArray(body.witness) ||
                !body.witness.every((item) => typeof item === 'string' && isHex(item)))
        ) {
            return res.status(400).json({
                error: 'witness must be an array of hex strings',
            });
        }

        const steps = debugScriptExecution({
            scriptSig: body.scriptSig,
            scriptPubKey: body.scriptPubKey,
            witness: body.witness,
            rawTxHex: body.rawTxHex,
            inputIndex: body.inputIndex,
        });

        return res.json(steps);
    });

    return router;
}
