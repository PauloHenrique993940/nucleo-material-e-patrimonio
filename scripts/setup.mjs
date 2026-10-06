import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('backend/.env')) {
  const secret = randomBytes(48).toString('hex');
  const password = randomBytes(18).toString('base64url');
  writeFileSync(
    'backend/.env',
    `DATABASE_URL=postgresql://nucleo:nucleo_local@localhost:15432/nucleo?schema=public\nJWT_SECRET=${secret}\nFRONTEND_URL=http://localhost:5173\nPORT=3001\nSEED_ADMIN_EMAIL=admin@nucleo.local\nSEED_ADMIN_PASSWORD=${password}\nTEST_DATABASE_URL=postgresql://nucleo:nucleo_local@localhost:15432/nucleo_test?schema=public\nSMTP_HOST=\nSMTP_PORT=587\nSMTP_FROM=\nSMTP_USER=\nSMTP_PASSWORD=\n`,
  );
  console.log('backend/.env criado. A senha inicial está em SEED_ADMIN_PASSWORD nesse arquivo.');
} else console.log('backend/.env já existe e foi preservado.');
