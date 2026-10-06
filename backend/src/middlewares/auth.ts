import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../repositories/db.js';
import { AppError } from '../utils/stock.js';
import { jwtSecret } from '../utils/environment.js';
import '../utils/session.js';
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Entre para continuar.');
  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(header.slice(7), jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, 'Sessão expirada.');
  }
  const u = await db.user.findUnique({
    where: { id: String(claims.sub) },
    include: { role: true },
  });
  if (!u?.active || claims.version !== u.sessionVersion)
    throw new AppError(401, 'Sessão inválida. Entre novamente.');
  req.session = { id: u.id, role: u.role.name };
  next();
}
export const allow = (roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!roles.includes(req.session.role))
    throw new AppError(403, 'Seu perfil não permite esta operação.');
  next();
};
export const writers = ['ADMIN', 'MANAGER', 'OPERATOR'];
