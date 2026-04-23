import cors from 'cors';
import express from 'express';
import { createApiRouter } from './routes';

export function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(createApiRouter());

    app.get('/health', (_req, res) => {
        res.json({ ok: true, service: 'scriptscope-api' });
    });

    return app;
}

if (require.main === module) {
    const app = createApp();
    const port = Number(process.env.PORT ?? 4000);

    app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`ScriptScope API listening on http://localhost:${port}`);
    });
}
