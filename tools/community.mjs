// SPDX-License-Identifier: GPL-2.0-only
// The community collection (community/): every pack checked as the site reads it (ui/src/packs.ts, communityEntry).
//   node --experimental-transform-types tools/community.mjs check         every pack valid, or the list of problems (exit 1)
//   node --experimental-transform-types tools/community.mjs build OUTDIR  and OUTDIR/index.json with the packs copied beside it
import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { communityEntry, communityIndex } = await import('../ui/src/packs.ts');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../community');
const [mode, out] = process.argv.slice(2);
if (mode !== 'check' && !(mode === 'build' && out)) {
  console.error('Usage: node --experimental-transform-types tools/community.mjs check | build OUTDIR');
  process.exit(2);
}

const entries = [], problems = [];
for (const kind of ['recipes', 'ratios']) {
  let names = [];
  try { names = await readdir(join(root, kind)); } catch { continue; }
  for (const name of names.sort()) {
    if (name === '.gitkeep' || name === 'README.md') continue;
    const path = `${kind}/${name}`;
    try {
      const bytes = await readFile(join(root, path));
      entries.push(communityEntry(path, new TextDecoder('utf-8', { fatal: true }).decode(bytes), bytes.length));
    } catch (e) { problems.push(e instanceof Error ? e.message : String(e)); }
  }
}
// Anything else in community/ besides the two folders and the README is refused too.
for (const name of await readdir(root)) {
  if (!['recipes', 'ratios', 'README.md'].includes(name)) problems.push(`${name}: the collection holds recipes/, ratios/ and README.md only`);
}
if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log(`${entries.length} packs valid (${entries.filter((e) => e.kind === 'recipes').length} recipes, ${entries.filter((e) => e.kind === 'ratios').length} ratios)`);
if (mode === 'build') {
  const target = resolve(out);
  for (const e of entries) {
    await mkdir(dirname(join(target, e.file)), { recursive: true });
    await copyFile(join(root, e.file), join(target, e.file));
  }
  await writeFile(join(target, 'index.json'), JSON.stringify(communityIndex(entries)) + '\n');
}
