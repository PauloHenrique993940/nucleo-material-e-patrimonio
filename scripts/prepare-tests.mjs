import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
const environment = { ...dotenv.parse(readFileSync('backend/.env')), ...process.env };
if (!environment.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL.');
const target = new URL(environment.TEST_DATABASE_URL);
const production = new URL(environment.DATABASE_URL);
if (target.host === production.host && target.pathname === production.pathname)
  throw new Error('O banco de testes deve ser diferente do banco da aplicação.');
const name = target.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Nome de banco inválido.');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} terminou com código ${result.status}`);
  return result;
};
const check = spawnSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    'nucleo',
    '-d',
    'postgres',
    '-tAc',
    `SELECT 1 FROM pg_database WHERE datname = '${name}'`,
  ],
  { encoding: 'utf8' },
);
if (check.status !== 0) throw new Error('Inicie o PostgreSQL com docker compose up -d db.');
if (!check.stdout.trim())
  run('docker', ['compose', 'exec', '-T', 'db', 'createdb', '-U', 'nucleo', name]);
const env = { ...environment, DATABASE_URL: environment.TEST_DATABASE_URL };
run(process.execPath, ['../node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  cwd: 'backend',
  env,
});
run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], { cwd: 'backend', env });
console.log('Banco de testes preparado sem apagar dados existentes.');
