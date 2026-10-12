// Public sources only. Progress, repository activity, and PC releases are independent.
export const REFRESH_MS = 60 * 60 * 1000;
export const DECOMP_INDEX = 'https://decomp.dev/projects';
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function percentage(value) {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  const match = String(value ?? '').match(/(?:^|\s|>)(\d+(?:\.\d+)?)\s*%/);
  return match ? percentage(Number(match[1])) : null;
}
export function readDecomp(project, entry) {
  if (
    !entry ||
    `${entry.owner}/${entry.repo}`.toLowerCase() !== project.repo.toLowerCase() ||
    entry.default_version !== project.progress.version
  )
    throw Error('Missing expected project or version');
  // Byte-perfect matching is distinct from fuzzy similarity and linked source.
  const value = percentage(entry.measures?.matched_code_percent);
  if (value === null) throw Error('No matching code measurement');
  return {
    value,
    version: entry.default_version,
    label: 'Matching code · decomp.dev',
    source: `https://decomp.dev/${project.repo}/${entry.default_version}`,
    reportAt: entry.commit?.timestamp ?? null,
    reportCommit: entry.commit?.sha ?? null,
  };
}
export function readBadge(project, data) {
  const value = percentage(project.progress.type === 'shield' ? data.message : data);
  if (value === null) throw Error('No valid percentage in source');
  return {
    value,
    version: project.progress.version,
    label: project.progress.label,
    source: project.progress.page ?? project.progress.url,
  };
}
export function readReadme(project, text) {
  if (!/This repo contains a full decompilation of Super Mario 64/i.test(text))
    throw Error('Completion declaration unavailable');
  return {
    value: 100,
    version: project.progress.version,
    label: project.progress.label,
    source: `https://github.com/${project.repo}#readme`,
  };
}
export async function refreshProjects(catalog, previous = {}, fetcher = fetch, now = Date.now()) {
  const checkedAt = new Date(now).toISOString();
  const requests = new Map();
  const get = (url, type = 'json') => {
    if (!requests.has(url))
      requests.set(
        url,
        (async () => {
          const response = await fetcher(url, {
            headers: { Accept: type === 'json' ? 'application/json' : 'text/plain' },
            signal: AbortSignal.timeout(15000),
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
          });
          if (!response.ok) throw Error(`Source returned ${response.status}`);
          return type === 'json' ? response.json() : response.text();
        })(),
      );
    return requests.get(url);
  };
  const index = get(DECOMP_INDEX).then((data) => {
    if (!Array.isArray(data.projects)) throw Error('Invalid project index');
    return new Map(data.projects.map((p) => [`${p.owner}/${p.repo}`.toLowerCase(), p]));
  });
  // Attach a handler immediately, including when the first projects use badges.
  index.catch(() => {});
  const settled = async (old, task) => {
    try {
      return { ...(await task()), checkedAt, stale: false };
    } catch {
      return old ? { ...old, stale: true } : { checkedAt: null, stale: true };
    }
  };
  const entries = await Promise.all(
    catalog.map(async (project) => {
      const old = previous[project.id] ?? {};
      const progressTask = settled(old.progress, async () => {
        const spec = project.progress;
        if (spec.type === 'decomp')
          return readDecomp(project, (await index).get(project.repo.toLowerCase()));
        if (spec.type === 'readme') return readReadme(project, await get(spec.url, 'text'));
        return readBadge(project, await get(spec.url, spec.type === 'shield' ? 'json' : 'text'));
      });
      // Latest default-branch commit; a report commit can be older than the repository.
      const activityTask = settled(old.activity, async () => {
        const commits = await get(
          `https://api.github.com/repos/${project.repo}/commits?per_page=1`,
        );
        const commit = commits[0];
        if (!commit?.commit?.committer?.date || !commit.html_url)
          throw Error('No repository activity');
        return { date: commit.commit.committer.date, url: commit.html_url };
      });
      const relatedTask = Promise.all(
        project.related.map(async (related) => {
          const key = related.repo ?? related.name;
          const previousRelated = old.related?.[key];
          const result = await settled(previousRelated, async () => {
            if (related.evidence) {
              const readme = await get(related.evidence, 'text');
              if (!readme.includes(related.keyword))
                throw Error('Announcement no longer in source');
              const status =
                related.pendingPhrase && !readme.includes(related.pendingPhrase)
                  ? 'Check supported games'
                  : related.announcement;
              return { status, url: related.url ?? `https://github.com/${related.repo}` };
            }
            if (related.announcement)
              return { status: related.announcement, url: `https://github.com/${related.repo}` };
            const releases = await get(
              `https://api.github.com/repos/${related.repo}/releases?per_page=1`,
            );
            if (!Array.isArray(releases)) throw Error('Invalid release feed');
            const release = releases[0];
            return release
              ? {
                  status: release.prerelease ? 'Pre-release' : 'Release',
                  tag: release.tag_name,
                  date: release.published_at,
                  url: release.html_url,
                }
              : { status: 'Source project', url: `https://github.com/${related.repo}` };
          });
          return [key, result];
        }),
      );
      const [progress, activity, related] = await Promise.all([
        progressTask,
        activityTask,
        relatedTask,
      ]);
      return [project.id, { progress, activity, related: Object.fromEntries(related) }];
    }),
  );
  return { schemaVersion: 1, attemptedAt: checkedAt, projects: Object.fromEntries(entries) };
}
const dateText = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : null;
const link = (url, text, className = '') =>
  `<a class="${className}" href="${escape(/^https:\/\//.test(url ?? '') ? url : '#')}" target="_blank" rel="noopener noreferrer">${text}</a>`;
export function groupProjects(catalog, states = {}) {
  const value = (project) => percentage(states[project.id]?.progress?.value);
  const completed = catalog.filter((project) => value(project) === 100);
  const ongoing = catalog
    .filter((project) => value(project) !== 100)
    .sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1));
  return { completed, ongoing };
}
export function renderCatalog(catalog, states = {}, completedOpen = true) {
  const { completed, ongoing } = groupProjects(catalog, states);
  const cards = (projects) =>
    projects.map((project) => renderCard(project, states[project.id])).join('\n');
  return `${completed.length ? `<details class="progress-completed" id="community-completed" data-progress-completed${completedOpen ? ' open' : ''}><summary><span class="progress-group-label">Completed decompilations <span class="progress-group-count">${completed.length}</span><small>100% of the tracked code metric</small></span><span class="progress-disclosure-action"><span class="progress-action-hide">Hide<span class="progress-action-suffix"> completed</span></span><span class="progress-action-show">Show<span class="progress-action-suffix"> completed</span></span><span class="progress-disclosure-mark" aria-hidden="true"></span></span></summary><div class="progress-grid">${cards(completed)}</div></details>` : ''}${ongoing.length ? `<section class="progress-ongoing" aria-labelledby="community-ongoing-title"><div class="progress-group-heading"><h2 id="community-ongoing-title">In progress <span class="progress-group-count">${ongoing.length}</span></h2><p>Closest to completion first · unavailable metrics last</p></div><div class="progress-grid">${cards(ongoing)}</div></section>` : ''}`;
}
export function renderCard(project, state = {}) {
  const progress = state.progress ?? {},
    activity = state.activity ?? {};
  const value = percentage(progress.value),
    available = value !== null;
  const source =
    progress.source ??
    project.progress.page ??
    (project.progress.type === 'decomp'
      ? `https://github.com/${project.repo}#readme`
      : project.progress.url);
  const art = project.image
    ? `<img src="${escape(project.image)}" alt="" loading="lazy" decoding="async">`
    : `<span class="community-monogram" aria-hidden="true">${escape(project.mark)}</span>`;
  const metric = available
    ? `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}<small>%</small>`
    : '<span class="community-unavailable">Unavailable</span>';
  const bar = available
    ? `<div class="port-progress" role="progressbar" aria-label="${escape(project.name)} ${escape(progress.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><span style="width:${value}%"></span></div>`
    : '<div class="unknown-progress" aria-hidden="true"></div>';
  const related = project.related
    .map((item) => {
      const info = state.related?.[item.repo ?? item.name] ?? {};
      const url = item.repo ? `https://github.com/${item.repo}` : item.url;
      const status = info.status ?? item.announcement ?? 'View project';
      const release = info.tag ? ` ${link(info.url, escape(info.tag))}` : '';
      return `<div class="community-related-item">${link(url, `${escape(item.kind)} <span aria-hidden="true"></span>`, 'community-badge')}<span>${link(url, escape(item.name))} · ${escape(status)}${release}${info.stale ? ' · cached' : ''}</span></div>`;
    })
    .join('');
  return `<article class="progress-card community-card" data-community-id="${escape(project.id)}"><div class="progress-art game-icon">${art}</div><div class="progress-content"><h3>${link(`https://github.com/${project.repo}${project.sourcePath ?? ''}`, `${escape(project.name)}<span class="progress-open" aria-hidden="true"></span>`)}</h3><p>${escape(project.platform)} · ${escape(project.repo.split('/')[0])}</p><div class="progress-meta"><span>${available && value === 100 ? '100% of this metric' : available ? 'In progress' : 'Source available'}</span><strong>${metric}</strong></div>${bar}<p class="community-measure">${link(source, escape(progress.label ?? project.progress.label ?? (available ? 'Matching code · decomp.dev' : 'No public progress metric')))}<br><span>${escape(progress.version ?? project.progress.version)}</span></p><p class="community-activity">${activity.date ? link(activity.url, `Last commit ${escape(dateText(activity.date))}`) : link(`https://github.com/${project.repo}/commits`, `Repository activity`)}${activity.stale && activity.date ? ' · cached' : ''}</p><p class="community-check">${progress.checkedAt && available ? `${progress.stale ? 'Cached' : 'Checked'} ${escape(dateText(progress.checkedAt))}` : 'Live percentage unavailable'}${progress.reportAt ? ` · Report ${escape(dateText(progress.reportAt))}` : ''}</p>${project.note ? `<p class="community-detail">${escape(project.note)}</p>` : ''}${related ? `<div class="community-related">${related}</div>` : '<p class="community-no-port">No PC project linked yet.</p>'}</div></article>`;
}
