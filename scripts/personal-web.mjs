import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2] ?? 'build';
if (!['build', 'check', 'dev', 'preview'].includes(command)) throw new Error('Unsupported personal Web command.');
const env = { ...process.env, VITE_PERSONAL_WEB: 'true',
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'https://codex.onepiper.cloud',
  VITE_WEB_BASE_PATH: process.env.VITE_WEB_BASE_PATH || '/remoteai-web/',
  VITE_PUBLIC_WEB_URL: process.env.VITE_PUBLIC_WEB_URL || 'https://mengkaitao88.github.io/remoteai-web/' };
const child = spawn(process.execPath, ['scripts/run.mjs', command, ...process.argv.slice(3)], {
  cwd: root, stdio: 'inherit', env,
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
