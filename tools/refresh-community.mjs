import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { refreshProjects, REFRESH_MS } from '../src/features/community/community-data.mjs';

// Public feeds only. --watch keeps a local publication snapshot current;
// the browser independently refreshes the live cards without a deployment.
const args = process.argv.slice(2);
if (args.some((arg) => !['--watch', '--build', '--help'].includes(arg)))
  throw Error('Use --watch, --build or --help.');
if (args.includes('--help')) {
  console.log(
    'node tools/refresh-community.mjs [--watch] [--build]\nChecks public progress reports, repository commits and the Worms tracker.\n--watch repeats hourly; --build rebuilds the local static preview after each check.\nThis script never commits, pushes or publishes a site.',
  );
} else {
  const root = new URL('../', import.meta.url),
    target = new URL('public/data/community-snapshot.json', root);
  const stop = new AbortController();
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => stop.abort());
  do {
    const catalog = JSON.parse(readFileSync(new URL('public/data/community-projects.json', root)));
    let previous = {};
    try {
      previous = JSON.parse(readFileSync(target)).projects;
    } catch {}
    const snapshot = await refreshProjects(catalog, previous);
    const temporary = fileURLToPath(target) + `.tmp-${process.pid}`;
    try {
      writeFileSync(temporary, JSON.stringify(snapshot, null, 2) + '\n');
      renameSync(temporary, fileURLToPath(target));
    } finally {
      try {
        unlinkSync(temporary);
      } catch {}
    }
    const states = Object.values(snapshot.projects);
    const progress = states.filter((p) => p.progress.value != null && !p.progress.stale).length;
    const activity = states.filter((p) => p.activity.date && !p.activity.stale).length;
    console.log(
      `${catalog.length} projects; ${progress} live percentages; ${activity} repository commits refreshed; checked ${snapshot.attemptedAt}`,
    );
    for (const project of catalog) {
      const p = snapshot.projects[project.id];
      if (p.progress.stale)
        console.warn(
          `${project.name}: ${p.progress.value == null ? 'percentage unavailable' : 'keeping dated percentage'} (${p.progress.error})`,
        );
    }
    if (args.includes('--build')) {
      const result = spawnSync('python3', ['tools/build.py'], {
        cwd: fileURLToPath(root),
        stdio: 'inherit',
      });
      if (result.status !== 0) throw Error('Snapshot updated; static build failed.');
    }
    if (!args.includes('--watch') || stop.signal.aborted) break;
    try {
      await delay(REFRESH_MS, undefined, { signal: stop.signal });
    } catch {
      break;
    }
  } while (!stop.signal.aborted);
}
