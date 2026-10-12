/** Build a per-file, hash-pinned record from bundled source manifests. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename as pathBasename, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assets = join(root, 'public/assets');
const jsonOutput = join(root, 'public/asset-provenance.json');
const markdownOutput = join(root, 'docs/ASSET-CREDITS.md');

const RELEVANT_KEYS =
  /^(title|name|author|artist|credit|rights_holder|copyright|license|licence|license_url|licence_url|source|source_url|source_page|url|asset|file|reference|original|original_source|usage|purpose|provenance|processing|treatment|notes|description|ripped_by|supplied_by|upscaler|model|scope)$/i;

function filesUnder(directory) {
  return readdir(directory, { withFileTypes: true }).then(async (entries) => {
    const nested = await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesUnder(path) : [path];
      }),
    );
    return nested.flat().sort();
  });
}

function safeRelative(path) {
  return relative(root, path).split(sep).join('/');
}

function normalizeAssetReference(reference, manifest) {
  if (
    typeof reference !== 'string' ||
    !reference ||
    /^https?:|^data:|^user[- ]supplied/i.test(reference)
  )
    return null;
  const candidate = resolve(join(manifest, '..'), reference.replace(/^\.\//, ''));
  return candidate === assets || candidate.startsWith(`${assets}${sep}`) ? candidate : null;
}

function detailsFrom(value, depth = 0) {
  if (depth > 5 || value == null || typeof value !== 'object') return {};
  const details = {};
  if (Array.isArray(value)) return details;
  for (const [key, entry] of Object.entries(value)) {
    if (
      RELEVANT_KEYS.test(key) &&
      (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')
    ) {
      details[key] = String(entry).slice(0, 900);
    }
  }
  return details;
}

function fileMentions(value, relativePath, basename, manifest, trail = []) {
  const hits = [];
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1)
      hits.push(
        ...fileMentions(value[index], relativePath, basename, manifest, [...trail, String(index)]),
      );
    return hits;
  }

  const fields = ['file', 'filename', 'asset', 'path', 'image', 'evidence', 'original'];
  for (const field of fields) {
    const reference = value[field];
    if (typeof reference !== 'string') continue;
    const resolvedReference = normalizeAssetReference(reference, manifest);
    const exactPath = resolvedReference && safeRelative(resolvedReference) === relativePath;
    const exactName = !reference.includes('/') && reference === basename;
    if (exactPath || exactName)
      hits.push({
        trail: [...trail, field],
        details: detailsFrom(value),
        matchedBy: exactPath ? 'path' : 'filename',
      });
  }

  for (const [key, entry] of Object.entries(value)) {
    if (
      key === basename ||
      (normalizeAssetReference(key, manifest) &&
        safeRelative(normalizeAssetReference(key, manifest)) === relativePath)
    ) {
      hits.push({
        trail: [...trail, key],
        details: { ...detailsFrom(value), ...detailsFrom(entry) },
        matchedBy: 'record-key',
      });
    }
    hits.push(...fileMentions(entry, relativePath, basename, manifest, [...trail, key]));
  }
  // Icon records are keyed by the icon stem (e.g. "sm64"), while their
  // processed assets and originals have different extensions and directories.
  if (safeRelative(manifest) === 'public/assets/icons/sources.json' && trail.length === 0) {
    const stem = basename.slice(0, -extname(basename).length);
    const entry = value[stem];
    if (entry && relativePath.startsWith('public/assets/icons/')) {
      hits.push({ trail: [stem], details: detailsFrom(entry), matchedBy: 'icon-key' });
    }
  }
  return hits;
}

function compactEvidence(hit, manifest) {
  const entry = {
    record: safeRelative(manifest),
    match: hit.matchedBy,
    field: hit.trail.join('.'),
    details: hit.details,
  };
  if (!Object.keys(entry.details).length) delete entry.details;
  return entry;
}

function isExplicitlyUnlicensed(evidence) {
  const text = JSON.stringify(evidence).toLowerCase();
  return /no explicit.{0,30}licen[cs]e|no.{0,24}open redistribution licen[cs]e|permission.{0,24}unknown|not public domain|no reuse licen[cs]e/.test(
    text,
  );
}

function permissionStatus(evidence) {
  const exact = evidence.filter((item) => item.match !== 'directory');
  if (exact.length && isExplicitlyUnlicensed(exact))
    return 'permission-unknown-explicitly-documented';
  if (exact.some((item) => item.details && (item.details.license || item.details.licence)))
    return 'license-named-in-source-record-recheck-rights-holder';
  if (exact.length) return 'source-recorded-permission-not-established';
  if (evidence.length) return 'context-only-permission-not-established';
  return 'source-and-permission-not-documented';
}

function markdownEscape(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function sourceSummary(evidence) {
  const found = [];
  for (const item of evidence) {
    const details = item.details ?? {};
    const source =
      details.source_url ||
      details.source ||
      details.url ||
      details.source_page ||
      details.original_source;
    const author =
      details.author ||
      details.credit ||
      details.ripped_by ||
      details.supplied_by ||
      details.rights_holder;
    const license = details.license || details.licence;
    const parts = [
      author,
      source,
      license && `Recorded license: ${license}`,
      details.processing || details.treatment || details.usage,
    ].filter(Boolean);
    if (parts.length) found.push(parts.join(' · '));
    if (found.length === 3) break;
  }
  return found.join(' / ') || 'No individual source is identified for this file in the records.';
}

function permissionSummary(status) {
  return {
    'permission-unknown-explicitly-documented':
      'The source note explicitly says permission is unconfirmed.',
    'license-named-in-source-record-recheck-rights-holder':
      'A license is named; the rights holder and coverage still need verification.',
    'source-recorded-permission-not-established':
      'A source or provenance record exists, but no reuse license was found for this file.',
    'context-only-permission-not-established':
      'Only project context is recorded; no file-specific source or permission is confirmed.',
    'source-and-permission-not-documented':
      'No associated source note or permission was found in the examined manifests.',
  }[status];
}

const allFiles = await filesUnder(assets);
const manifests = allFiles.filter((path) =>
  /(?:source|provenance)[^/]*\.json$/i.test(pathBasename(path)),
);
const manifestData = await Promise.all(
  manifests.map(async (path) => ({ path, value: JSON.parse(await readFile(path, 'utf8')) })),
);

const records = [];
for (const path of allFiles) {
  const relativePath = safeRelative(path);
  const basename = path.split(sep).at(-1);
  const byteContent = await readFile(path);
  const evidence = [];

  for (const manifest of manifestData) {
    const hits = fileMentions(manifest.value, relativePath, basename, manifest.path);
    for (const hit of hits) evidence.push(compactEvidence(hit, manifest.path));
    if (
      !hits.length &&
      path.startsWith(`${manifest.path.slice(0, manifest.path.lastIndexOf(sep))}${sep}`)
    ) {
      const context = detailsFrom(manifest.value);
      if (Object.keys(context).length)
        evidence.push({
          record: safeRelative(manifest.path),
          match: 'directory',
          details: context,
        });
    }
  }

  if (extname(path).toLowerCase() === '.json' && !manifests.includes(path)) {
    try {
      const embedded = JSON.parse(byteContent.toString('utf8'));
      const details = detailsFrom(embedded.credit ?? embedded);
      if (Object.keys(details).length)
        evidence.push({ record: relativePath, match: 'embedded-credit', details });
    } catch {
      /* A non-JSON .json file is represented by its digest and missing metadata. */
    }
  }

  const deduplicated = [...new Map(evidence.map((item) => [JSON.stringify(item), item])).values()];
  const status = permissionStatus(deduplicated);
  records.push({
    path: relativePath,
    bytes: byteContent.length,
    sha256: createHash('sha256').update(byteContent).digest('hex'),
    evidence: deduplicated,
    permissionStatus: status,
  });
}

const counts = Object.fromEntries(
  [...new Set(records.map((item) => item.permissionStatus))]
    .sort()
    .map((status) => [status, records.filter((item) => item.permissionStatus === status).length]),
);
const ledger = {
  schemaVersion: 1,
  project: 'Esteban’s Forge · v1.0.0',
  generatedBy: 'tools/build-provenance.mjs',
  assetFileCount: records.length,
  counts,
  reviewScope:
    'This inventory records bundled evidence and file hashes. It does not independently verify copyright ownership, the continued availability of source pages, or permissions beyond the terms recorded in source manifests.',
  attributionNotice:
    'A credit or source link does not by itself grant permission to copy, adapt, or redistribute a work. Unknown permissions remain unknown.',
  files: records,
};

const markdown = [
  '# Asset credits and permission inventory',
  '',
  'This register is generated from `public/assets/` and its source manifests by `npm run provenance`. It includes every media, font, manifest, and JSON file in that directory, with its SHA-256 digest, available evidence, and permission status based on that evidence.',
  '',
  `Inventoried files: **${records.length}**.`,
  '',
  '## Understanding the status',
  '',
  '- `license-named-in-source-record-recheck-rights-holder`: a manifest names a license; this tool does not verify that the correct rights holder granted it for this use.',
  '- `source-recorded-permission-not-established`: a file-specific source is recorded, but no reuse permission is established.',
  '- `permission-unknown-explicitly-documented`: the source note explicitly says the license or permission is unconfirmed.',
  '- `context-only-permission-not-established`: project context exists, but no file-specific source or permission is established.',
  '- `source-and-permission-not-documented`: no associated source or permission was found in the examined manifests.',
  '',
  '> Attribution is not permission. This inventory improves traceability; it is not legal advice or a guarantee that publication, adaptation, or redistribution is authorized. Missing licenses remain explicitly unresolved.',
  '',
  '## Per-file register',
  '',
  '| File | Source and attribution evidence | Documented status | SHA-256 |',
  '| --- | --- | --- | --- |',
  ...records.map(
    (item) =>
      `| \`${markdownEscape(item.path)}\` | ${markdownEscape(sourceSummary(item.evidence))} | ${markdownEscape(permissionSummary(item.permissionStatus))} | \`${item.sha256}\` |`,
  ),
  '',
  '## Review for future versions',
  '',
  'Before adding, replacing, or redistributing an asset, identify its rights holder, check the original source page and license terms, record transformations, and update the nearest manifest. If permission cannot be demonstrated, mark it as unresolved rather than inferring it.',
  '',
].join('\n');

const json = `${JSON.stringify(ledger, null, 2)}\n`;
assert.equal(
  records.length,
  allFiles.length,
  'Every eligible public asset must appear exactly once',
);
const duplicatePaths = records
  .map((item) => item.path)
  .filter((path, index, list) => list.indexOf(path) !== index);
assert.deepEqual(duplicatePaths, [], 'Asset ledger must not contain duplicate paths');

if (process.argv.includes('--check')) {
  assert.equal(
    await readFile(jsonOutput, 'utf8').catch(() => ''),
    json,
    'public/asset-provenance.json is stale; run npm run provenance',
  );
  assert.equal(
    await readFile(markdownOutput, 'utf8').catch(() => ''),
    markdown,
    'docs/ASSET-CREDITS.md is stale; run npm run provenance',
  );
  console.log(
    `PASS: provenance ledger covers ${records.length} files (${JSON.stringify(counts)}).`,
  );
} else {
  await writeFile(jsonOutput, json);
  await writeFile(markdownOutput, markdown);
  console.log(`Generated provenance for ${records.length} files (${JSON.stringify(counts)}).`);
}
