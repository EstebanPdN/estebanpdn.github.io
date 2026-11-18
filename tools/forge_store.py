"""Render the forge.store catalog snapshot into static markup at build time.

`public/data/forge-store-catalog.json` is imported by tools/sync-forge-store.py.
Pages use explicit `<!-- forge-store: name -->` markers; unknown names fail the build.
"""
from datetime import date
from html import escape
import json
from pathlib import Path
import re

MARKER = re.compile(r'<!-- forge-store:\s*([a-z-]+)(?:\s+(\d+))?\s*-->')
TAB_ICONS = {
    'all': '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    'forge': '<path d="M3 7h12c0 3-2 5-5 5H8l1 4H7l-1-4C4 12 3 10 3 7Z"/><path d="M15 9h5M9 16h6l1 4H6l1-4"/>',
    'community': '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14c2.6 0 4.4 1.5 5 4"/>',
    'emulators': '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="18" cy="13.7" r=".9"/>',
    'tools': '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5Z"/><path d="M14.5 6.5 17 4l3 3-2.5 2.5"/>',
}


def load(root):
    return json.loads((Path(root) / 'public/data/forge-store-catalog.json').read_text())


def pretty_date(value):
    return date.fromisoformat(value).strftime('%B %-d, %Y') if value else ''


def platform_line(app):
    origin = app.get('origin') or ''
    if app['category'] == 'tools':
        return 'Nintendo 3DS tool'
    if app['category'] == 'emulators':
        return f'{origin} emulator' if origin else 'Emulator'
    return f'{origin} → 3DS' if origin else 'Nintendo 3DS'


def chips(app):
    items = []
    release = app.get('release')
    if app['status'] == 'development':
        progress = app.get('progress')
        label = f'In development · {progress}%' if progress is not None else 'In development'
        items.append(('is-development', label))
    elif release:
        items.append(('is-version', release['tag']))
    compat = app.get('compat') or {}
    if compat.get('o3ds') is False:
        items.append(('is-console', 'New 3DS only'))
    elif compat.get('o3ds') == 'experimental' or compat.get('recommended') == 'n3ds':
        items.append(('is-console', 'New 3DS recommended'))
    else:
        items.append(('is-console', 'Old & New 3DS'))
    if compat.get('stereo') is True:
        items.append(('is-stereo', '3D'))
    if 'rom' in app.get('needs', []):
        items.append(('is-needs', 'Uses your ROM'))
    elif 'data' in app.get('needs', []):
        items.append(('is-needs', 'Uses your game files'))
    return ''.join(f'<span class="store-chip {cls}">{escape(text)}</span>' for cls, text in items)


def card(app):
    tags = ' '.join(app['tags'])
    search = ' '.join(filter(None, [app['title'], app['author'], app.get('origin'), app.get('tagline'), *app['tags']])).casefold()
    if app.get('page'):
        open_tag = f'<a class="store-app-link" href="{escape(app["page"], quote=True)}">'
        close_tag = '</a>'
        action = 'Project page'
    elif app.get('repo'):
        url = f'https://github.com/{app["repo"]}'
        open_tag = f'<a class="store-app-link" href="{escape(url, quote=True)}" target="_blank" rel="noreferrer">'
        close_tag = '</a>'
        action = 'GitHub'
    else:
        open_tag, close_tag, action = '<div class="store-app-link">', '</div>', ''
    icon_style = f' style="background:{escape(app["iconBackground"], quote=True)}"' if app.get('iconBackground') else ''
    icon_class = 'store-app-icon is-pixel' if app.get('pixelIcon') else 'store-app-icon'
    stars = f'<span class="store-app-stars" aria-label="{app["stars"]} GitHub stars">★ {app["stars"]:,}</span>' if app.get('stars') else ''
    author = 'by ' + app['author']
    forge = '<span class="store-app-forge" title="Esteban’s Forge project">Forge</span>' if 'forge' in app['tags'] else ''
    action_html = f'<span class="store-app-action">{action}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span>' if action else ''
    return (
        f'<li class="store-app" data-tags="{escape(tags, quote=True)}" data-search="{escape(search, quote=True)}">'
        f'{open_tag}<span class="{icon_class}"{icon_style}><img src="{escape(app["icon"], quote=True)}" alt="" width="64" height="64" loading="lazy" decoding="async" /></span>'
        f'<span class="store-app-body"><span class="store-app-head"><strong>{escape(app["title"])}</strong>{stars}</span>'
        f'<span class="store-app-meta">{escape(author)} · {escape(platform_line(app))}{forge}</span>'
        f'<span class="store-app-tagline">{escape(app.get("tagline") or "")}</span>'
        f'<span class="store-app-chips">{chips(app)}</span>{action_html}</span>{close_tag}</li>'
    )


SHOWCASE_TABS = ('forge', 'community', 'emulators', 'tools')
GRID_SIZE = 10
GLYPHS = {
    'download': '<path d="M12 4v10m-4-4 4 4 4-4M5 19h14"/>',
    'wifi': '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.2" r="1.2"/>',
    'search': '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
    'sd': '<path d="M7 3h7l4 4v14H7Z"/><path d="M10 3v4M13 3v4"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    'github': '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    'rom': '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 17h6"/>',
    'wrench': '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5Z"/>',
}


def glyph(name, cls=''):
    return f'<svg class="fs-glyph {cls}" viewBox="0 0 24 24" aria-hidden="true">{GLYPHS[name]}</svg>'


def app_fields(app):
    """Everything the upper screen shows for one app."""
    banner = app.get('banner') or {}
    release = app.get('release')
    if app['status'] == 'development':
        version = 'In development' + (f' · {app["progress"]}%' if app.get('progress') is not None else '')
    else:
        version = release['tag'] if release else ''
    needs = {'rom': 'Uses your ROM', 'data': 'Uses your game files'}.get((app.get('needs') or [None])[0], '')
    size = f'{app["download_bytes"] / 1_048_576:.1f} MB' if app.get('download_bytes') else ''
    gradient = banner.get('gradient') or []
    return {
        'title': app['title'],
        'meta': f'by {app["author"]} · {platform_line(app)}',
        'version': version,
        'development': 'true' if app['status'] == 'development' else '',
        'needs': needs,
        'stars': f'★ {app["stars"]:,}' if app.get('stars') else '',
        'size': size,
        'art': banner.get('art') or '',
        'position': banner.get('position') or '50% 50%',
        'logo': banner.get('logo') or '',
        'logo-scale': str(banner.get('logo_scale') or 1),
        'pixel': 'true' if banner.get('pixel') else '',
        'gradient': f'linear-gradient(160deg,{",".join(gradient)})' if gradient else '',
    }


def app_data(app):
    """Carry the upper-screen fields on the app's grid icon."""
    return ' '.join(f'data-{key}="{escape(value, quote=True)}"' for key, value in app_fields(app).items())


def banner_layer(app, active):
    banner = app.get('banner') or {}
    art = banner.get('art')
    logo = banner.get('logo')
    gradient = banner.get('gradient') or []
    style = f' style="background-image:linear-gradient(160deg,{escape(",".join(gradient))})"' if gradient else ''
    art_html = f'<img class="fs-art" src="{escape(art, quote=True)}" alt="" style="object-position:{escape(banner.get("position") or "50% 50%")}" />' if art else '<img class="fs-art" alt="" hidden />'
    if logo:
        front = f'<img class="fs-logo" src="{escape(logo, quote=True)}" alt="" style="--logo-scale:{banner.get("logo_scale") or 1}" />'
    else:
        front = f'<img class="fs-logo is-icon" src="{escape(app["icon"], quote=True)}" alt="" />'
    return f'<div class="fs-banner-layer{" is-active" if active else ""}"{style}>{art_html}{front}</div>'


def showcase(data):
    apps = data['apps']
    by_tab = {tab: [app for app in apps if tab in app['tags']][:GRID_SIZE] for tab in SHOWCASE_TABS}
    first = by_tab['forge'][0]
    info = app_fields(first)
    tabs = ''.join(
        f'<span class="fs-tab{" is-active" if category["id"] == "forge" else ""}" data-tab="{category["id"]}">'
        f'<svg viewBox="0 0 24 24" aria-hidden="true">{TAB_ICONS.get(category["id"], TAB_ICONS["all"])}</svg>{escape(category["label"])}</span>'
        for category in data['categories']
    )
    grids = []
    for tab in SHOWCASE_TABS:
        icons = ''.join(
            f'<span class="fs-icon{" is-selected" if app is first else ""}{" is-pixel" if app.get("pixelIcon") else ""}" {app_data(app)}>'
            f'<img src="{escape(app["icon"], quote=True)}" alt="" loading="lazy" decoding="async" />'
            f'{"<i class=\"fs-badge\">" + glyph("wrench") + "</i>" if app["status"] == "development" else ""}</span>'
            for app in by_tab[tab]
        )
        grids.append(f'<div class="fs-grid{" is-active" if tab == "forge" else ""}" data-tab="{tab}">{icons}</div>')
    sparkles = ''.join(f'<i style="--x:{x}%;--y:{y}%;--d:{d}s"></i>' for x, y, d in ((18, 22, 0), (72, 14, 1.2), (86, 46, 2.1), (34, 58, 0.6), (60, 36, 1.7), (9, 48, 2.6)))
    return f'''<div class="fs-device" data-store-showcase aria-hidden="true">
<div class="fs-screen fs-top"><div class="fs-top-ui">
<div class="fs-banner">{banner_layer(first, True)}{banner_layer(first, False)}<span class="fs-sparkles">{sparkles}</span></div>
<div class="fs-status"><span class="fs-pill fs-brand"><img src="assets/brand/estebans-forge-icon.png" alt="" /><span><b>forge</b>.store</span><i></i><span class="fs-brand-section">store</span></span>
<span class="fs-pill fs-system">{glyph("download", "is-forge")}{glyph("wifi")}<span data-fs-clock>01:29</span><span class="fs-battery"><i></i></span><span>88%</span></span></div>
<div class="fs-card"><span class="fs-card-icon"><img data-fs="icon" src="{escape(first["icon"], quote=True)}" alt="" /></span>
<span class="fs-card-text"><strong data-fs="title">{escape(info["title"])}</strong><span class="fs-card-meta" data-fs="meta">{escape(info["meta"])}</span>
<span class="fs-card-chips"><span class="fs-chip is-version" data-fs="version"{" hidden" if not info["version"] else ""}>{escape(info["version"])}</span><span class="fs-chip is-needs"{" hidden" if not info["needs"] else ""}>{glyph("rom")}<span data-fs="needs">{escape(info["needs"])}</span></span></span></span>
<span class="fs-card-side"><span class="fs-stars" data-fs="stars">{escape(info["stars"])}</span><span class="fs-chip is-size"{" hidden" if not info["size"] else ""}>{glyph("download")}<span data-fs="size">{escape(info["size"])}</span></span></span></div>
</div></div>
<div class="fs-screen fs-bottom"><div class="fs-bottom-ui">
<div class="fs-tabs"><span class="fs-key" data-fs-key="l">L</span><div class="fs-tab-strip"><div class="fs-tab-track">{tabs}</div></div><span class="fs-key" data-fs-key="r">R</span></div>
<div class="fs-grids">{"".join(grids)}</div>
<div class="fs-toolbar"><span>{glyph("search")}Search</span><span class="has-dot">{glyph("download")}Downloads</span><span>{glyph("sd")}SD</span><span>{glyph("settings")}Settings</span><span class="is-github">{glyph("github")}<i>X</i></span></div>
</div></div>
</div>'''


def render_store(html, root):
    """Expand forge.store markers on pages that contain them."""
    if '<!-- forge-store:' not in html:
        return html
    data = load(root)
    apps = data['apps']
    store = data['store']

    def render(match):
        name, argument = match.groups()
        if name == 'catalog':
            return f'<ul class="store-grid" id="store-grid">{"".join(card(app) for app in apps)}</ul>'
        if name == 'tabs':
            buttons = []
            for index, category in enumerate(data['categories']):
                icon = TAB_ICONS.get(category['id'], TAB_ICONS['all'])
                buttons.append(
                    f'<button type="button" data-store-tab="{escape(category["id"], quote=True)}" aria-pressed="{str(index == 0).lower()}">'
                    f'<svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>{escape(category["label"])}'
                    f'<span class="store-tab-count">{category["count"]}</span></button>'
                )
            return ''.join(buttons)
        if name == 'count':
            return str(len(apps))
        if name == 'forge-count':
            return str(sum('forge' in app['tags'] for app in apps))
        if name == 'version':
            return escape('v' + store['version'])
        if name == 'release-url':
            return escape(store['release'], quote=True)
        if name == 'cia-size':
            return f'{store["cia_bytes"] / 1_000_000:.1f} MB'
        if name == 'updated':
            return escape(pretty_date(data.get('catalog_updated')))
        if name == 'revision':
            return str(data.get('catalog_revision') or '')
        if name == 'showcase':
            return showcase(data)
        if name == 'ambient':
            first = next(app for app in apps if 'forge' in app['tags'])
            art = escape(first['banner']['art'] or first['icon'], quote=True)
            return f'<img class="is-active" src="{art}" alt="" /><img alt="" />'
        if name == 'icons':
            limit = int(argument or 8)
            picks = [app for app in apps if app['status'] == 'released'][:limit]
            return ''.join(
                f'<span class="store-promo-icon{" is-pixel" if app.get("pixelIcon") else ""}"><img src="{escape(app["icon"], quote=True)}" alt="" width="56" height="56" loading="lazy" decoding="async" /></span>'
                for app in picks
            )
        raise ValueError(f'Unknown forge.store marker: {name}')

    return MARKER.sub(render, html)
