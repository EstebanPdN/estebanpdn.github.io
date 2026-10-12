// Public invite metadata refreshes only while the Info panel is visible.
(() => {
  const panel = document.getElementById('dual-info');
  if (!panel) return;
  const interval = 300000,
    cacheKey = 'forge-discord-community-v1';
  let current,
    lastUpdate = 0,
    timer,
    pending = false;
  const visible = () => !panel.hidden && !document.hidden && panel.isConnected;
  const count = (value) => new Intl.NumberFormat('en-US').format(value);
  function paint(data, live = false) {
    if (!panel.isConnected || !data?.name) return;
    current = data;
    lastUpdate = Date.parse(data.updated_at) || 0;
    document.getElementById('info-discord-name').textContent = data.name;
    document.getElementById('info-discord-description').textContent =
      data.description || 'Meet the community, follow the ports and share what you’re playing.';
    if (Number.isFinite(data.members))
      document.getElementById('info-discord-members').textContent =
        `≈ ${count(data.members)} members`;
    if (Number.isFinite(data.online))
      document.getElementById('info-discord-online').textContent = `${count(data.online)} online`;
    const status = document.getElementById('info-discord-status');
    status.textContent = live ? 'Live community estimate' : 'Last available estimate';
    status.title = `Updated ${new Date(lastUpdate).toLocaleString()}`;
    panel.dataset.discordStatus = live ? 'live' : 'cached';
    if (data.guild_id && data.icon_hash) {
      const src = `https://media.discordapp.net/icons/${data.guild_id}/${data.icon_hash}.png?size=128`;
      const image = new Image();
      image.src = src;
      image
        .decode()
        .then(() => {
          if (panel.isConnected && current === data) {
            const icon = document.getElementById('info-discord-icon');
            icon.src = src;
            icon.alt = data.name + ' community icon';
          }
        })
        .catch(() => {});
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (visible()) timer = setTimeout(refresh, interval);
  }
  async function refresh() {
    if (!visible() || pending) return;
    if (Date.now() - lastUpdate < interval) {
      schedule();
      return;
    }
    pending = true;
    try {
      const response = await fetch(
        'https://discord.com/api/v10/invites/zy8BqH5ss?with_counts=true&with_expiration=true',
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Community unavailable');
      const data = await response.json(),
        guild = data.guild;
      if (!guild?.id || !Number.isFinite(data.approximate_member_count))
        throw new Error('Community data unavailable');
      const snapshot = {
        name: guild.name,
        description: guild.description,
        guild_id: guild.id,
        icon_hash: guild.icon,
        members: data.approximate_member_count,
        online: data.approximate_presence_count,
        updated_at: new Date().toISOString(),
      };
      paint(snapshot, true);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(snapshot));
      } catch {}
    } catch {
      if (current) paint(current, false);
    } finally {
      pending = false;
      schedule();
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey));
    if (saved?.name) paint(saved, Date.now() - Date.parse(saved.updated_at) < interval);
  } catch {}
  if (!current)
    fetch('data/discord-community.json')
      .then((response) => response.json())
      .then((data) => {
        if (!current) paint(data);
        refresh();
      })
      .catch(() => refresh());
  new MutationObserver(() => {
    if (visible()) refresh();
    else clearTimeout(timer);
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => {
    if (visible()) refresh();
    else clearTimeout(timer);
  });
  refresh();
})();
