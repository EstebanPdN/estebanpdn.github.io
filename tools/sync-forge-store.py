"""Import the forge.store catalog snapshot and its icons from the store repository.

Usage: python3 tools/sync-forge-store.py /path/to/forge.store

Writes public/data/forge-store-catalog.json (English, display fields only) and
copies each catalog icon plus the store screenshots to public/assets/forge-store/.
The site renders that snapshot at build time; it never fetches the live catalog.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data/forge-store-catalog.json'
ASSETS = ROOT / 'public/assets/forge-store'
# Projects the portfolio deliberately does not show (see tests/test-site-integrity.py).
EXCLUDED = {'butterscotch'}
SITE = 'https://estebanpdn.github.io/'
# Portfolio pages for projects whose catalog entry has no public page yet.
LOCAL_PAGES = {'rvc': 'red-viper-color.html'}
STORE_REPOSITORY = 'https://github.com/EstebanPdN/forge.store'
SCREENS = {
    'store-preview.png': 'docs/images/store-preview.png',
    'store-preview-light.png': 'docs/images/store-preview-light.png',
    'store-qr.png': 'docs/images/forge-store-qr.png',
}


def english(value):
    return value.get('en') if isinstance(value, dict) else value


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def app_record(app):
    stable = (app.get('releases') or {}).get('stable') or {}
    page = app.get('page') or ''
    needs = sorted({item['id'] for item in app.get('requires') or [] if item.get('id') in {'rom', 'data'}})
    return {
        'id': app['id'],
        'title': app['title'],
        'category': app['category'],
        'tags': app.get('tags') or [app['category']],
        'author': app['author'],
        'origin': (app.get('origin') or {}).get('platform'),
        'status': app['status'],
        'progress': app.get('progress'),
        'stars': app.get('stars'),
        'tagline': english(app.get('tagline')),
        'compat': app.get('compat') or {},
        'release': {'tag': stable['tag'], 'date': stable.get('date')} if stable.get('tag') else None,
        'repo': app.get('repo'),
        'page': page.removeprefix(SITE) if page.startswith(SITE) else LOCAL_PAGES.get(app['id']),
        'needs': needs,
        'icon': f'assets/forge-store/icons/{app["id"]}.webp',
        'iconBackground': app.get('iconBackground'),
        'pixelIcon': bool(app.get('pixelIcon')),
        'download_bytes': next((stable['assets'][kind]['size'] for kind in ('cia', '3dsx', 'zip') if kind in (stable.get('assets') or {})), None),
        'banner': banner_record(app),
    }


def banner_record(app):
    banner = app.get('banner') or {}
    return {
        'art': f'assets/forge-store/banners/{app["id"]}-art.webp' if banner.get('bg') else None,
        'position': banner.get('bgPos') or '50% 50%',
        'logo': f'assets/forge-store/banners/{app["id"]}-logo.webp' if banner.get('logo') else None,
        'logo_scale': banner.get('logoScale') or 1,
        'pixel': bool(banner.get('pixel')),
        'gradient': banner.get('gradient'),
    }


def sync(source):
    catalog = json.loads((source / 'catalog/forge-store.json').read_text())
    manifest = json.loads((source / 'builds/3ds/manifest.json').read_text())
    apps = [app for app in catalog['apps'] if app['id'] not in EXCLUDED]
    for folder in ('icons', 'banners'):
        if (ASSETS / folder).exists():
            shutil.rmtree(ASSETS / folder)  # Drop media of apps that left the catalog.
        (ASSETS / folder).mkdir(parents=True)
    records, files = [], []
    for app in apps:
        banner = app.get('banner') or {}
        media = [('icons', f'{app["id"]}.webp', app['icon'], 'icon')]
        media += [('banners', f'{app["id"]}-{kind}.webp', banner[key], f'banner {kind}') for key, kind in (('bg', 'art'), ('logo', 'logo')) if banner.get(key)]
        for folder, name, relative, label in media:
            shutil.copyfile(source / relative, ASSETS / folder / name)
            files.append({
                'file': f'{folder}/{name}',
                'title': f'{app["title"]} {label} as shown in forge.store',
                'author': app['author'],
                'source': f'forge.store catalog, {relative}',
                'source_url': f'https://github.com/{app["repo"]}' if app.get('repo') else STORE_REPOSITORY,
                'notes': 'Copied unchanged from the forge.store repository. Rights remain with the original project and game owners; see forge.store docs/ASSET-CREDITS.md and docs/ART-DIRECTION.md.',
            })
        records.append(app_record(app))
    for name, relative in SCREENS.items():
        shutil.copyfile(source / relative, ASSETS / name)
        files.append({
            'file': name,
            'title': 'forge.store interface capture' if name != 'store-qr.png' else 'QR code for the forge.store CIA',
            'author': 'EstebanPdN',
            'source': f'forge.store repository, {relative}',
            'source_url': STORE_REPOSITORY,
            'notes': 'Copied unchanged. Displayed game artwork belongs to its respective owners.',
        })
    for entry in files:
        entry['sha256'] = sha256(ASSETS / entry['file'])
    (ASSETS / 'sources.json').write_text(json.dumps({'scope': 'forge.store page media', 'files': files}, indent=2, ensure_ascii=False) + '\n')

    counts = {}
    for record in records:
        for tag in record['tags']:
            counts[tag] = counts.get(tag, 0) + 1
    snapshot = {
        'format': 'portfolio-forge-store/1',
        'catalog_revision': catalog['store'].get('revision'),
        'catalog_updated': catalog['store'].get('updated'),
        'store': {
            'version': manifest['version'],
            'cia_bytes': manifest['files']['forge-store.cia']['bytes'],
            'repository': STORE_REPOSITORY,
            'release': f'{STORE_REPOSITORY}/releases/tag/v{manifest["version"]}',
        },
        'categories': [
            {'id': category['id'], 'label': english(category['label']), 'count': len(records) if category['id'] == 'all' else counts.get(category['id'], 0)}
            for category in catalog['categories']
        ],
        'apps': records,
    }
    DATA.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + '\n')
    print(f'Synced {len(records)} apps (excluded: {", ".join(sorted(EXCLUDED))}) from {source}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='forge.store repository checkout')
    sync(parser.parse_args().source.resolve())
