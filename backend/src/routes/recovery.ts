import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { db } from '../repositories/db.js';
import { AppError } from '../utils/stock.js';
import { passwordSchema } from '../schemas/index.js';
export const recovery = Router();
recovery.use(
  ['/forgot-password', '/reset-password'],
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
);
recovery.post('/forgot-password', async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email().toLowerCase() }).parse(req.body);
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
    throw new AppError(503, 'Recuperação por e-mail indisponível. Contate o administrador.');
  const user = await db.user.findUnique({ where: { email } });
  if (user?.active) {
    const token = randomBytes(32).toString('hex');
    await db.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
        : {}),
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Recuperação de senha — Núcleo de Material e Patrimônio',
      text: `Redefina sua senha em até 30 minutos: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`,
    });
  }
  res.json({ message: 'Se o e-mail estiver cadastrado, você receberá as instruções.' });
});
recovery.post('/reset-password', async (req, res) => {
  const data = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: passwordSchema })
    .parse(req.body);
  const hash = createHash('sha256').update(data.token).digest('hex');
  await db.$transaction(async (tx) => {
    const reset = await tx.passwordReset.findUnique({ where: { tokenHash: hash } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date())
      throw new AppError(400, 'Link inválido ou expirado.');
    const result = await tx.passwordReset.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (result.count !== 1) throw new AppError(400, 'Link já utilizado.');
    await tx.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash: await bcrypt.hash(data.password, 12),
        sessionVersion: { increment: 1 },
      },
    });
    await tx.passwordReset.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: reset.userId,
        operation: 'REDEFINIÇÃO SENHA',
        recordId: reset.userId,
        ip: req.ip,
      },
    });
  });
  res.json({ message: 'Senha atualizada. Entre novamente.' });
});
