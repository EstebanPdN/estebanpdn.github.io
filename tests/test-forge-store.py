"""Check the forge.store snapshot, its rendered page and the homepage showcase."""
import json
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from forge_store import render_store  # noqa: E402

data = json.loads((ROOT / 'public/data/forge-store-catalog.json').read_text())
apps = data['apps']
errors = []


def require(condition, message):
    if not condition:
        errors.append(message)


ids = [app['id'] for app in apps]
require(len(ids) == len(set(ids)), 'Duplicate app ids in the snapshot')
require('butterscotch' not in ids, 'Butterscotch must stay out of the portfolio')
for app in apps:
    media = [app['icon'], app['banner']['art'], app['banner']['logo']]
    for path in filter(None, media):
        require((ROOT / 'public' / path).is_file(), f'{app["id"]}: missing {path}')
    require(app['banner']['art'] or app['banner']['gradient'], f'{app["id"]}: upper screen needs art or a gradient')
    if app.get('page'):
        require((ROOT / 'src/pages' / app['page']).is_file(), f'{app["id"]}: missing page {app["page"]}')

page = render_store((ROOT / 'src/pages/forge-store.html').read_text(), ROOT)
require('<!-- forge-store:' not in page, 'Unexpanded forge.store marker on the store page')
require(page.count('class="store-app"') == len(apps), 'Catalog must list every snapshot app')
require(page.count('data-store-showcase') == 1, 'Store page needs one showcase')
try:
    render_store('<!-- forge-store: nonsense -->', ROOT)
    errors.append('Unknown markers must fail the build')
except ValueError:
    pass

index = (ROOT / 'src/pages/index.html').read_text()
feature, promo, library = (index.find(marker) for marker in ('id="dual-feature"', 'id="forge-store"', 'id="dual-library"'))
require(-1 < feature < promo < library, 'The forge.store section must sit between the carousel and Released Ports')
section = index[promo:library]
require('href="forge-store.html"' in section and 'Check it out' in section, 'Homepage section needs its Check it out link')
require('<!-- forge-store: showcase -->' in section, 'Homepage section needs the animated showcase')
rendered = render_store(index, ROOT)
grid_tabs = len(re.findall(r'class="fs-grid[ "]', rendered))
require(grid_tabs == 4, f'Showcase must roll through four categories, found {grid_tabs}')

if errors:
    print('FAIL: forge.store checks')
    print('\n'.join(f'  - {message}' for message in errors))
    raise SystemExit(1)
print(f'PASS: {len(apps)} forge.store apps with local media, rendered page and homepage showcase.')
