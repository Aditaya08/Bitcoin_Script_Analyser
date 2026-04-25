import { Router } from 'express';
import { createTxRouter } from './tx';
import { createScriptRouter } from './script';
import { TxFetcher } from '../services/tx-fetcher';

export function createApiRouter(fetcher: TxFetcher = new TxFetcher()): Router {
    const router = Router();

    router.use('/api/tx', createTxRouter(fetcher));
    router.use('/api/script', createScriptRouter());

    return router;
}
