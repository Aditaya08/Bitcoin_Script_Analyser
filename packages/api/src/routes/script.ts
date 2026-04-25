import { Router } from 'express';
import { Buffer } from 'buffer';
import { classifyScript } from '../classifiers';
import { scriptToAsm } from '../utils/script-utils';
import { isHex } from '../utils/validation-utils';
import { debugScriptExecution } from '../debugger';

export function createScriptRouter(): Router {
    const router = Router();

    router.post('/classify', (req, res) => {
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

    router.post('/debug', (req, res) => {
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
