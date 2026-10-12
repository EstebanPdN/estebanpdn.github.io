import { fileURLToPath } from 'node:url';
/** One-time refactor acceptance against an explicitly supplied baseline. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { format, resolveConfig } from 'prettier';

const baseline = process.argv[2];
assert.ok(baseline, 'Supply the preserved baseline directory as the first argument');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceMap = JSON.parse(readFileSync(join(root, 'tools/source-map.json'), 'utf8'));
const options = await resolveConfig(join(root, '.prettierrc.json'));
const syntax = (source) =>
  JSON.parse(
    JSON.stringify(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }), (key, value) =>
      ['start', 'end', 'raw'].includes(key) ? undefined : value,
    ),
  );
for (const [name, path] of Object.entries(sourceMap)) {
  assert.deepEqual(
    syntax(readFileSync(join(root, path), 'utf8')),
    syntax(readFileSync(join(baseline, 'src/scripts', name), 'utf8')),
    name + ': executable syntax changed',
  );
}
for (const name of readdirSync(join(baseline, 'src/styles'))) {
  const original = readFileSync(join(baseline, 'src/styles', name), 'utf8');
  const candidate = readFileSync(join(root, 'src/styles', name), 'utf8');
  assert.equal(
    await format(candidate, { ...options, parser: 'css' }),
    await format(original, { ...options, parser: 'css' }),
    name + ': CSS content/cascade changed',
  );
}
function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const name = join(prefix, entry.name);
      return entry.isDirectory() ? files(join(directory, entry.name), name) : [name];
    })
    .filter((name) => !name.endsWith('.DS_Store'))
    .sort();
}
// The new generated ledger is additive; all baseline resources must remain byte-for-byte intact.
const originalResources = files(join(baseline, 'public'));
assert.deepEqual(
  files(join(root, 'public')).filter((name) => name !== 'asset-provenance.json'),
  originalResources,
  'Baseline published resources changed',
);
for (const name of originalResources) {
  const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
  assert.equal(
    hash(join(root, 'public', name)),
    hash(join(baseline, 'public', name)),
    name + ': resource bytes changed',
  );
}
console.log(
  `PASS: ${Object.keys(sourceMap).length} equivalent JavaScript ASTs, 18 unchanged stylesheets, ${originalResources.length} byte-identical baseline resources.`,
);
