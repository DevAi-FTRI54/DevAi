// Checks every golden label against the pinned clone: file exists, range in bounds, symbol inside range.
// Usage: npm run eval:validate [-- --golden path/to/golden.json]
import 'dotenv/config';
import fs from 'fs';
import { loadGolden, argValue } from './lib/golden.js';
import { clonePath, readRepoLines } from './lib/repoFiles.js';

const SLACK = 3;

async function main() {
  const golden = loadGolden(argValue('golden'));
  let root = clonePath(golden.repoId, golden.sha);
  if (!fs.existsSync(root)) {
    const { cloneRepo } = await import('../src/features/indexing/git.service.js');
    root = (await cloneRepo(golden.repoUrl, golden.sha)).localRepoPath;
  }

  const errors: string[] = [];
  const ids = new Set<string>();
  const perCategory: Record<string, number> = {};

  for (const item of golden.items) {
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate id`);
    ids.add(item.id);
    perCategory[item.category] = (perCategory[item.category] ?? 0) + 1;
    if (!item.key_facts?.length) errors.push(`${item.id}: no key_facts`);
    if (!item.expected_sources.some((s) => s.required)) {
      errors.push(`${item.id}: no required source`);
    }

    for (const src of item.expected_sources) {
      const where = `${item.id} ${src.file}`;
      const lines = readRepoLines(root, src.file);
      if (!lines) {
        errors.push(`${where}: file not found at ${golden.sha.slice(0, 7)}`);
        continue;
      }
      let from = 1;
      let to = lines.length;
      if (src.lines) {
        const [s, e] = src.lines;
        if (s < 1 || e < s || e > lines.length) {
          errors.push(`${where}: range ${s}-${e} out of bounds (file has ${lines.length} lines)`);
          continue;
        }
        from = Math.max(1, s - SLACK);
        to = Math.min(lines.length, e + SLACK);
      }
      if (src.symbol) {
        const window = lines.slice(from - 1, to).join('\n');
        if (!window.includes(src.symbol)) {
          errors.push(`${where}: symbol "${src.symbol}" not found in lines ${from}-${to}`);
        }
      }
    }
  }

  console.log(`Golden set: ${golden.name} (${golden.items.length} items)`);
  console.log('Per category:', perCategory);
  if (errors.length) {
    console.error(`\n${errors.length} label error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('All labels valid.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
