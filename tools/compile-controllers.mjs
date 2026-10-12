import { fileURLToPath } from 'node:url';
/** Compile page-local scripts into mountable modules with the original scope. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';
import { format, resolveConfig } from 'prettier';

const specification = JSON.parse(readFileSync(0, 'utf8'));
const options = await resolveConfig(fileURLToPath(new URL('../.prettierrc.json', import.meta.url)));
const controllers = join(specification.directory, 'page-controllers');
mkdirSync(controllers, { recursive: true });

for (const page of specification.pages) {
  const imports = [];
  const bodies = [];
  for (const name of page.scripts) {
    const source = readFileSync(join(specification.directory, name), 'utf8');
    const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    let offset = 0;
    const parts = [];
    for (const node of program.body) {
      if (node.type !== 'ImportDeclaration') continue;
      parts.push(source.slice(offset, node.start));
      const declaration = source.slice(node.start, node.end);
      const localPath = node.source.value;
      if (!localPath.startsWith('./'))
        throw new Error(`Unexpected controller import: ${localPath}`);
      imports.push(declaration.replace(localPath, '../' + localPath.slice(2)));
      offset = node.end;
    }
    parts.push(source.slice(offset));
    bodies.push(parts.join(''));
  }
  const restore = page.name === 'index' ? readFileSync(specification.restore, 'utf8') : '';
  const capture = page.name === 'index' ? '{ game: currentGame, filter: visibleFilter }' : '{}';
  const module = `${imports.join('\n')}
export function mount(scope, saved = {}) {
  return scope.run(() => {
    const {
      document, window, addEventListener, removeEventListener,
      setTimeout, clearTimeout, setInterval, clearInterval,
      requestAnimationFrame, cancelAnimationFrame, matchMedia,
      IntersectionObserver, ResizeObserver, MutationObserver, fetch
    } = scope;
    const location = scope.location || globalThis.location;
    ${bodies.join('\n')}
    ${restore}
    return { capture: () => (${capture}) };
  });
}
`;
  writeFileSync(
    join(controllers, page.name + '.js'),
    await format(module, { ...options, parser: 'babel' }),
  );
}
