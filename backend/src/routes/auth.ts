import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { login } from '../controllers/auth.js';
import { recovery } from './recovery.js';
export const auth = Router();
auth.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de acesso. Aguarde 15 minutos.' },
  }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => createHash('sha256')
      .update(typeof req.body?.login === 'string' ? req.body.login.trim().toLowerCase() : '')
      .digest('hex'),
    message: { message: 'Muitas tentativas para esta conta. Aguarde 15 minutos.' },
  }),
  login,
);
auth.use(recovery);
