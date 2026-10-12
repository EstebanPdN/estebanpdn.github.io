import { readFileSync, writeFileSync } from 'node:fs';
import { renderCatalog } from '../src/features/community/community-data.mjs';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('public/data/community-projects.json', root)));
const snapshot = JSON.parse(readFileSync(new URL('public/data/community-snapshot.json', root)));
const target = process.argv[2];
const html = readFileSync(target, 'utf8').replace(
  '<!-- COMMUNITY_CARDS -->',
  renderCatalog(catalog, snapshot.projects),
);
if (html.includes('<!-- COMMUNITY_CARDS -->'))
  throw Error('Community placeholder was not rendered');
writeFileSync(target, html);
