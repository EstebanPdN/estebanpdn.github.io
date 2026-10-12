/** Locate production statements by syntax, independent of indentation/quotes. */
import assert from 'node:assert/strict';
import { parse, tokenizer } from 'acorn';

function tokens(source) {
  const stream = tokenizer(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const result = [];
  for (;;) {
    const token = stream.getToken();
    if (token.type.label === 'eof') break;
    // Prettier adds optional parentheses around arrow parameters. They do not
    // identify the statement a harness is selecting; executable text is intact.
    if (['(', ')'].includes(token.type.label)) continue;
    result.push({ key: token.type.label + ':' + String(token.value), start: token.start });
  }
  return result;
}

export function position(source, marker, after = 0) {
  const haystack = tokens(source);
  const needle = tokens(marker);
  const found = haystack.findIndex(
    (token, index) =>
      token.start >= after &&
      needle.every((part, offset) => haystack[index + offset]?.key === part.key),
  );
  assert.ok(found >= 0, `Production statement not found: ${marker}`);
  return haystack[found].start;
}

export function declaration(source, name) {
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const node = program.body.find(
    (statement) =>
      statement.type === 'VariableDeclaration' &&
      statement.declarations.some((item) => item.id.name === name),
  );
  assert.ok(node, `Production declaration not found: ${name}`);
  return source.slice(node.start, node.end);
}

export function statementEnd(source, marker, after = 0) {
  const start = position(source, marker, after);
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const node = program.body.find((statement) => statement.start <= start && statement.end > start);
  assert.ok(node, `Containing statement not found: ${marker}`);
  return node.end;
}
