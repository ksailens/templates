import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import compose from 'docker-compose';

const componseBaseDir = path.resolve('pdf-env');
const composeOptions = ['-f', path.resolve(componseBaseDir, 'docker-compose.yml')];

export const stopPdfServer = async () => {
    const ps = await compose.ps({ composeOptions });
    const pdfServer = ps.data.services.find(({ name }) => name.includes('pdf-server'));
    if (!pdfServer?.state?.includes('Exit')) {
        await compose.down({ composeOptions });
    }
};

export const runPdfServer = async () => {
    const ps = await compose.ps({ composeOptions });
    const pdfServer = ps.data.services.find(({ name }) => name.includes('pdf-server'));
    if (pdfServer?.state?.includes('Exit')) {
        await compose.upAll({ composeOptions });
    }
};

async function createServer() {
    await runPdfServer().catch(() => {
        console.error('Docker not started!');
        process.exit(1);
    });
    const app = express();
    app.set('twig options', {
        allow_async: true,
        strict_variables: false,
    });

    // Create Vite server in middleware mode and configure the app type as
    // 'custom', disabling Vite's own HTML serving logic so parent server
    // can take control
    const vite = await createViteServer({
        server: { middlewareMode: true },
        plugins: [tsconfigPaths()],
        appType: 'custom',
        cacheDir: path.resolve('cache'),
    });

    // use vite's connect instance as middleware
    // if you use your own express router (express.Router()), you should use router.use
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
        const url = req.originalUrl;

        try {
            const items = url.split('/');
            const template = fs.readFileSync(
                path.resolve('templates', ...items.slice(0, items.length - 1), items[items.length - 1] + '.twig'),
                'utf-8',
            );
            const data = JSON.parse(
                fs.readFileSync(
                    path.resolve('templates', ...items.slice(0, items.length - 1), items[items.length - 1] + '.json'),
                    'utf-8',
                ),
            );
            const { renderTwig } = await vite.ssrLoadModule('/src/render.ts');
            res.status(200).end(await renderTwig(template, data, url.includes('pdf')));
        } catch (e) {
            // If an error is caught, let Vite fix the stack trace so it maps back to
            // your actual source code.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            vite.ssrFixStacktrace(e);
            next(e);
        }
    });

    const port = 8080;
    app.listen(port, () => {
        console.info(`🚀Renderer started on ${port} port`);
    });
}

createServer();

