import type { Prisma } from '@prisma/client';
export type Session = { id: string; role: string };
declare global {
  namespace Express {
    interface Request {
      session: Session;
    }
  }
}
export const publicUser = (u: Prisma.UserGetPayload<{ include: { role: true } }>) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  registration: u.registration,
  active: u.active,
  role: u.role.name,
});
