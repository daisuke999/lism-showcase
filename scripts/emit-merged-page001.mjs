/**
 * lp001（開発ページ lp001）向けエントリ。中身は emit-merged-page.mjs へ委譲する。
 * Usage: node scripts/emit-merged-page001.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(__dirname, 'emit-merged-page.mjs'), '001'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});
process.exit(r.status ?? 1);
