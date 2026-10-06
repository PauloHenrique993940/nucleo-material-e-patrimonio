import { mkdirSync, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
mkdirSync('backups', { recursive: true });
const path = `backups/nucleo-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
const child = spawn(
  'docker',
  ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', 'nucleo', '-d', 'nucleo', '-Fc'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
const finished = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`pg_dump terminou com código ${code}`)),
  );
});
try {
  await Promise.all([pipeline(child.stdout, createWriteStream(path, { flags: 'wx' })), finished]);
  console.log(`Backup criado: ${path}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
