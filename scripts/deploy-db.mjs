import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = new URL('../', import.meta.url);
dotenv.config({ path: fileURLToPath(new URL('backend/.env', root)), quiet: true });
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error('Configure DIRECT_URL ou DATABASE_URL para aplicar as migrations.');

const result = spawnSync(
  process.execPath,
  [fileURLToPath(new URL('node_modules/prisma/build/index.js', root)), 'migrate', 'deploy'],
  {
    cwd: fileURLToPath(new URL('backend/', root)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
