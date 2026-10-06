import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: `${root}/backend/.env`, quiet: true });
const sourceUrl = process.env.MIGRATION_SOURCE_URL;
const targetUrl = process.env.DIRECT_URL;
if (!sourceUrl || !targetUrl) throw new Error('Configure MIGRATION_SOURCE_URL e DIRECT_URL.');
const target = new URL(targetUrl);
if (!target.hostname.endsWith('.neon.tech') || target.hostname.includes('-pooler'))
  throw new Error('DIRECT_URL deve ser uma conexão direta Neon.');
const source = new PrismaClient({ datasourceUrl: sourceUrl });
const destination = new PrismaClient({ datasourceUrl: targetUrl });
const pgBin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
function run(command, args, connection) {
  const url = new URL(connection);
  const result = spawnSync(`${pgBin}/${command}.exe`, args, {
    cwd: root,
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
      PGCHANNELBINDING: url.searchParams.get('channel_binding') || 'prefer',
    },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} falhou (${result.status}).`);
}
async function counts(client) {
  const names = [
    'Role',
    'User',
    'Category',
    'Supplier',
    'Department',
    'Material',
    'StockMovement',
    'Patrimony',
    'PatrimonyTransfer',
    'AuditLog',
    'PasswordReset',
    '_prisma_migrations',
  ];
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => {
        const [row] = await client.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS count FROM public."${name}"`,
        );
        return [name, row.count];
      }),
    ),
  );
}
try {
  const tables =
    await destination.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (tables.length) throw new Error('Destino não está vazio; restauração cancelada.');
  const before = await counts(source);
  fs.mkdirSync(`${root}/backups`, { recursive: true });
  const backup = `${root}/backups/pre-neon-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
  run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', backup], sourceUrl);
  run(
    'pg_restore',
    [
      '--dbname',
      decodeURIComponent(target.pathname.slice(1)),
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      '--single-transaction',
      backup,
    ],
    targetUrl,
  );
  const after = await counts(destination);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Contagens divergentes; preserve a origem e investigue.');
  console.log('Backup:', backup);
  console.log('Contagens da origem e destino conferem:', JSON.stringify(after));
} finally {
  await Promise.all([source.$disconnect(), destination.$disconnect()]);
}
