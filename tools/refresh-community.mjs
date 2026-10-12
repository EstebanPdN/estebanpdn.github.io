import { readFileSync, writeFileSync } from 'node:fs';
import { refreshProjects } from '../src/features/community/community-data.mjs';
const root = new URL('../public/data/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('community-projects.json', root)));
let previous = {};
try {
  previous = JSON.parse(readFileSync(new URL('community-snapshot.json', root))).projects;
} catch {}
const snapshot = await refreshProjects(catalog, previous);
writeFileSync(new URL('community-snapshot.json', root), JSON.stringify(snapshot, null, 2) + '\n');
console.log(
  `${catalog.length} projects; ${Object.values(snapshot.projects).filter((p) => p.progress.value != null && !p.progress.stale).length} live percentages; checked ${snapshot.attemptedAt}`,
);
