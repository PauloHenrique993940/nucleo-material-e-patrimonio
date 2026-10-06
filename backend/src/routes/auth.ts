import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
  }),
  login,
);
auth.use(recovery);
