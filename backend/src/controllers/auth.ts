import type { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../repositories/db.js';
import { AppError } from '../utils/stock.js';
import { publicUser } from '../utils/session.js';
import { jwtSecret } from '../utils/environment.js';
export async function login(req: Request, res: Response) {
  const data = z
    .object({ login: z.string().trim().min(1).max(254), password: z.string().min(1).max(200) })
    .parse(req.body);
  const u = await db.user.findFirst({
    where: { OR: [{ email: data.login.toLowerCase() }, { registration: data.login }] },
    include: { role: true },
  });
  // Always perform a password check, including unknown users, to reduce account enumeration.
  const validPassword = await bcrypt.compare(data.password, u?.passwordHash || dummyPasswordHash);
  if (!u?.active || u.deletedAt || !validPassword)
    throw new AppError(401, 'E-mail, matrícula ou senha incorretos.');
  const token = jwt.sign({ sub: u.id, version: u.sessionVersion }, jwtSecret, {
    expiresIn: '8h',
    algorithm: 'HS256',
  });
  await db.auditLog.create({
    data: { userId: u.id, operation: 'LOGIN', recordId: u.id, ip: req.ip },
  });
  res.json({ token, user: publicUser(u) });
}
const dummyPasswordHash = bcrypt.hashSync('unavailable-account-password', 12);
