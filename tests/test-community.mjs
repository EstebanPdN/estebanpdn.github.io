import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  percentage,
  readDecomp,
  readTracker,
  decompURL,
  catalogKey,
  readBadge,
  refreshProjects,
  renderCard,
  groupProjects,
  renderCatalog,
} from '../src/features/community/community-data.mjs';

assert.equal(percentage(0), 0);
assert.equal(percentage(' 79.5%'), 79.5);
for (const input of [
  null,
  undefined,
  NaN,
  Infinity,
  -1,
  101,
  'unknown',
  '99% trailing',
  '100.1%',
]) {
  if (input === '99% trailing') continue;
  assert.equal(percentage(input), null, `Reject invalid percentage: ${input}`);
}
const game = {
  id: 'game',
  name: 'Test Game',
  platform: 'Wii',
  repo: 'team/game',
  mark: 'TG',
  progress: { type: 'decomp', version: 'US' },
  related: [{ kind: 'PC port', name: 'Port', repo: 'team/port' }],
};
const report = {
  owner: 'team',
  repo: 'game',
  default_version: 'US',
  measures: { fuzzy_match_percent: 99, matched_code_percent: 42, complete_code_percent: 12 },
  commit: { timestamp: '2026-10-01T00:00:00Z', sha: 'abc' },
};
assert.equal(readDecomp(game, report).value, 42, 'Only byte-perfect code measurement is used');
assert.throws(
  () => readDecomp(game, { ...report, default_version: 'JP' }),
  'Do not silently substitute another version',
);
assert.throws(() => readDecomp(game, { ...report, measures: { fuzzy_match_percent: 99 } }));
assert.throws(() => readBadge({ ...game, progress: { type: 'shield' } }, { message: 'invalid' }));
const old = {
  game: {
    progress: { value: 42, checkedAt: '2026-10-01T00:00:00Z' },
    activity: { date: '2026-09-30T00:00:00Z' },
    related: { 'team/port': { tag: '1.0', status: 'Release' } },
  },
};
const offline = await refreshProjects(
  [game],
  old,
  async () => {
    throw Error('Offline');
  },
  Date.parse('2026-10-02T00:00:00Z'),
);
assert.equal(offline.projects.game.progress.value, 42);
assert.equal(offline.projects.game.progress.stale, true);
assert.equal(
  offline.projects.game.progress.checkedAt,
  '2026-10-01T00:00:00Z',
  'Failure cannot mark cached data as freshly checked',
);
const missing = await refreshProjects([game], {}, async () => {
  throw Error('Rate limited');
});
assert.equal(missing.projects.game.progress.value, undefined, 'Missing data cannot become 0%');
const calls = [];
const fake = async (url) => {
  calls.push(url);
  const data = url.includes('decomp.dev/')
    ? report
    : url.includes('/commits?')
      ? [
          {
            commit: { committer: { date: '2026-10-02T01:00:00Z' } },
            html_url: 'https://github.com/team/game/commit/def',
          },
        ]
      : [
          {
            tag_name: '2.0',
            prerelease: true,
            published_at: '2026-10-01T00:00:00Z',
            html_url: 'https://github.com/team/port/releases/tag/2.0',
          },
        ];
  return { ok: true, json: async () => data };
};
const live = await refreshProjects([game, { ...game, id: 'second' }], {}, fake);
assert.equal(
  calls.filter((u) => u.includes('decomp.dev/team/game/US.json?mode=overview')).length,
  1,
  'Shared sources fetched once',
);
assert.equal(calls.filter((u) => u.includes('/team/game/commits')).length, 1);
assert.equal(live.projects.game.related['team/port'].status, 'Pre-release');
assert.equal(
  live.projects.game.activity.date,
  '2026-10-02T01:00:00Z',
  'Activity is separate from an older progress report',
);
const hostile = renderCard(
  { ...game, name: '<script>alert(1)</script>' },
  {
    progress: { value: 50, source: 'javascript:alert(1)' },
    related: { 'team/port': { tag: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' } },
  },
);
assert.ok(!hostile.includes('<script>'));
assert.ok(!hostile.includes('href="javascript:'));
assert.ok(!hostile.includes('<img src=x'));
const catalog = JSON.parse(
  readFileSync(new URL('../public/data/community-projects.json', import.meta.url)),
);
assert.equal(catalog.length, 21);
assert.equal(new Set(catalog.map((p) => p.id)).size, 21);
assert.ok(
  catalog.find((p) => p.id === 'advance').repo === 'SAT-R/sa2',
  'Follow the current Sonic Advance repository',
);
assert.ok(
  catalog.every((p) => p.image),
  'Every community game has artwork',
);
const groupedGames = ['unknown', 'low', 'complete', 'high', 'zero', 'almost', 'tie'].map((id) => ({
  ...game,
  id,
}));
const groupedState = Object.fromEntries(
  Object.entries({ low: 12, complete: 100, high: 80, zero: 0, almost: 99.99, tie: 80 }).map(
    ([id, value]) => [id, { progress: { value } }],
  ),
);
const grouped = groupProjects(groupedGames, groupedState);
assert.deepEqual(
  grouped.completed.map((p) => p.id),
  ['complete'],
  'Only exact 100% belongs in the completed group',
);
assert.deepEqual(
  grouped.ongoing.map((p) => p.id),
  ['almost', 'high', 'tie', 'low', 'zero', 'unknown'],
  'Descending progress, stable ties, missing metric after 0%',
);
const collapsed = renderCatalog(groupedGames, groupedState, false);
assert.match(
  collapsed,
  /id="community-completed" data-progress-completed>/,
  'Source refresh can preserve a collapsed group',
);
assert.ok(
  collapsed.indexOf('data-community-id="complete"') <
    collapsed.indexOf('data-community-id="almost"'),
  'Completed games appear above ongoing games',
);
assert.equal(
  (collapsed.match(/data-community-id=/g) || []).length,
  groupedGames.length,
  'Grouping never loses or duplicates a card',
);
console.log(
  'PASS: source metrics/versions, stale fallback, independent activity, request deduplication, release status, safe rendering, all 21 icons, completion groups, descending progress, stable ties, unknown metrics and collapsed state.',
);

const tracker = {
  id: 'worms3d',
  name: 'Worms 3D',
  platform: 'GameCube',
  owner: 'EstebanPdN',
  url: 'https://worms-3d.estebanpdn.chatgpt.site',
  progress: {
    type: 'tracker',
    url: 'https://worms-3d.estebanpdn.chatgpt.site/progress.json',
    version: 'GameCube PAL',
    label: 'Exact bytes',
  },
  related: [],
};
const publicData = {
  schema: 1,
  game: 'Worms 3D',
  version: 'GameCube PAL',
  updated_at: '2026-10-23T16:52:28Z',
  summary: { exact_bytes: 25, total_bytes: 100, percent: 25 },
};
assert.equal(readTracker(tracker, publicData).value, 25);
assert.throws(
  () =>
    readTracker(tracker, {
      ...publicData,
      summary: { exact_bytes: 25, total_bytes: 100, percent: 75 },
    }),
  'Reject inconsistent headline/byte totals',
);
assert.throws(() => readTracker(tracker, { ...publicData, version: 'Other game version' }));
const trackerCalls = [];
const trackerLive = await refreshProjects([tracker], {}, async (url) => {
  trackerCalls.push(url);
  return { ok: true, json: async () => publicData };
});
assert.deepEqual(
  trackerCalls,
  [tracker.progress.url],
  'A tracker uses only its public feed, with no invented GitHub endpoint',
);
assert.equal(trackerLive.projects.worms3d.progress.value, 25);
const trackerCard = renderCard(tracker, trackerLive.projects.worms3d);
assert.ok(!trackerCard.includes('github.com/undefined'));
assert.ok(trackerCard.includes('Tracker updated'));
assert.equal(decompURL(game), 'https://decomp.dev/team/game/US.json?mode=overview');
assert.notEqual(
  catalogKey([game]),
  catalogKey([{ ...game, progress: { ...game.progress, version: 'JP' } }]),
  'Source changes invalidate a browser cache',
);
console.log(
  'PASS: individual report endpoints, tracker version/byte consistency, public tracker rendering and cache invalidation.',
);
