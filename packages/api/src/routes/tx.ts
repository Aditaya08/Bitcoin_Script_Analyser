import { Router } from 'express';
import { TxFetcher } from '../services/tx-fetcher';
import { isTxid } from '../utils/validation-utils';

export function createTxRouter(fetcher: TxFetcher): Router {
    const router = Router();

    router.get('/:txid', async (req, res) => {
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

    router.get('/:txid/input/:index', async (req, res) => {
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

    router.get('/:txid/output/:index', async (req, res) => {
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

    return router;
}
