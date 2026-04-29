/**
 * Wraps <style> block contents in @layer lism-custom { } when not already present.
 * Targets lp001/002/003 components and lp00X.astro.
 */
import fs from 'node:fs';
import path from 'node:path';

const roots = [
  'src/components/lp001',
  'src/components/lp002',
  'src/components/lp003',
  'src/pages',
];

const re = /<style([^>]*)>([\s\S]*?)<\/style>/g;

function processFile(filePath) {
  const name = path.basename(filePath);
  if (!name.endsWith('.astro')) return;
  if (!/^lp00[123]\.astro$/.test(name) && !filePath.includes('/lp00')) return;

  let text = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  text = text.replace(re, (full, attrs, body) => {
    const b = body.trim();
    if (!b) return full;
    if (b.startsWith('@layer lism-custom')) return full;
    if (b.startsWith('@layer lism-')) {
      if (b.includes('lism-custom')) return full;
    }
    changed = true;
    const inner = `  @layer lism-custom {\n${body}\n  }\n`;
    return `<style${attrs}>${inner}</style>`;
  });
  if (changed) {
    fs.writeFileSync(filePath, text, 'utf8');
    console.log('wrapped:', filePath);
  }
}

for (const r of roots) {
  if (!fs.existsSync(r)) continue;
  if (r === 'src/pages') {
    for (const f of ['lp001.astro', 'lp002.astro', 'lp003.astro']) {
      const p = path.join(r, f);
      if (fs.existsSync(p)) processFile(p);
    }
  } else {
    for (const ent of fs.readdirSync(r, { withFileTypes: true })) {
      if (ent.isFile() && ent.name.endsWith('.astro')) {
        processFile(path.join(r, ent.name));
      }
    }
  }
}
