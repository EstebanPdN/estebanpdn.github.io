import { fileURLToPath } from 'node:url';
/** Keep generated entry documents as readable as their maintained source. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';

const directory = process.argv[2];
const options = await resolveConfig(fileURLToPath(new URL('../.prettierrc.json', import.meta.url)));
for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.html'))) {
  const file = join(directory, name);
  writeFileSync(file, await format(readFileSync(file, 'utf8'), { ...options, parser: 'html' }));
}
