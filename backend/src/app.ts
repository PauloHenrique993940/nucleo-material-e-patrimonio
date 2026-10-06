import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { db } from './repositories/db.js';
import { openapi } from './openapi.js';
import { auth } from './routes/auth.js';
import { insights } from './routes/insights.js';
import { administration } from './routes/administration.js';
import { lists } from './routes/lists.js';
import { catalog } from './routes/catalog.js';
import { authenticate } from './middlewares/auth.js';
import { errorHandler } from './middlewares/errors.js';
import { AppError } from './utils/stock.js';
export const app = express();
app.disable('x-powered-by');
// Vercel supplies the client address through its trusted reverse proxy.
if (process.env.VERCEL === '1') app.set('trust proxy', 1);
app.use(
  helmet(),
  cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }),
  express.json({ limit: '100kb' }),
);
app.get('/api/health', async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});
app.get('/api/openapi.json', (_req, res) => res.json(openapi));
app.use(
  '/api/docs',
  helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  }),
  swaggerUi.serve,
  swaggerUi.setup(openapi),
);
app.use('/api/auth', auth);
app.use('/api', authenticate, insights, administration, lists, catalog);
app.use((_req, _res, next) => next(new AppError(404, 'Rota não encontrada.')));
app.use(errorHandler);
