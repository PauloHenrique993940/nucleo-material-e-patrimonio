import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/stock.js';
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError)
    return res.status(400).json({ message: error.issues.map((x) => x.message).join(' ') });
  if (error instanceof AppError) return res.status(error.status).json({ message: error.message });
  if (error instanceof SyntaxError && 'status' in error && error.status === 400)
    return res.status(400).json({ message: 'JSON inválido.' });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const errors: Record<string, [number, string]> = {
      P2002: [409, 'Registro duplicado.'],
      P2003: [409, 'Registro possui vínculos ou referência inválida.'],
      P2025: [404, 'Registro não encontrado.'],
      P2000: [400, 'Valor excede o limite permitido.'],
      P2004: [409, 'Operação viola uma regra do banco.'],
    };
    const known = errors[error.code];
    if (known) return res.status(known[0]).json({ message: known[1] });
  }
  console.error(error);
  return res.status(500).json({ message: 'Não foi possível concluir a operação.' });
};
