"""Build readable static routes and disposable scenes from maintained source.

Public filenames and script order preserve the original portfolio contract.
JavaScript imports are compiled by a syntax parser, independently of formatting.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
from port_releases import render_release_metadata

ROOT = Path(__file__).resolve().parents[1]
SHARED_SCRIPTS = {'theme.js', 'page-transitions.js', 'interaction-motion.js', 'forge-header.js'}
SHARED_STYLES = {'page-transitions.css', 'forge-header.css'}
SCRIPT_TAG = re.compile(r'<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"[^>]*>\s*</script\s*>')
POLICY = re.compile(r'(http-equiv="Content-Security-Policy"\s+content=")([^\"]+)')


def digest(path):
    """Preserve the twelve-character content-based cache key convention."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def validate_destination(destination):
    if destination == ROOT:
        raise ValueError('Output must be separate from the repository root')
    for name in ('src', 'public', 'tools', 'tests', 'docs', '.git', 'node_modules'):
        protected = ROOT / name
        if destination == protected or protected in destination.parents or destination in protected.parents:
            raise ValueError(f'Output overlaps maintained inputs: {name}')


def copy_runtime_sources(staged):
    """Flatten feature-owned source to its established public filenames."""
    names = set()
    for file in sorted((ROOT / 'src').rglob('*')):
        if not file.is_file() or file.suffix not in {'.js', '.mjs', '.css'}:
            continue
        if file.name == 'index-state.js':
            continue  # Build fragment appended inside the homepage scene scope.
        if file.name in names:
            raise ValueError(f'Duplicate public filename: {file.name}')
        names.add(file.name)
        shutil.copy2(file, staged / file.name)


def version_runtime_imports(staged):
    community = staged / 'community.js'
    source = community.read_text().replace("'./community-data.mjs'", f"'./community-data.mjs?v={digest(staged / 'community-data.mjs')}'")
    for name in ('community-projects.json', 'community-snapshot.json'):
        source = source.replace(f"'data/{name}'", f"'data/{name}?v={digest(staged / 'data' / name)}'")
    community.write_text(source)
    navigation = staged / 'page-transitions.js'
    navigation.write_text(navigation.read_text().replace("'./scene-runtime.js'", f"'./scene-runtime.js?v={digest(staged / 'scene-runtime.js')}'"))


def prepare_page(file, header, policy):
    """Retain shared bootstrap scripts and collect scene-local controllers."""
    html = render_release_metadata(file.read_text(), ROOT).replace('<!-- forge-header -->', header)
    scripts = []

    def collect(match):
        name = match[1]
        if name in SHARED_SCRIPTS:
            return match[0]
        scripts.append(name)
        return match[0] if name == 'welcome-init.js' else ''

    html = SCRIPT_TAG.sub(collect, html)
    html = POLICY.sub(lambda match: match[1] + policy, html)
    if 'src="theme.js"' not in html:
        html = re.sub(r'</head\s*>', '<script src="theme.js"></script></head>', html)
    return {'name': file.stem, 'html': html, 'scripts': scripts}


def compile_controllers(staged, pages):
    specification = {
        'directory': str(staged),
        'restore': str(ROOT / 'src/app/index-state.js'),
        'pages': [{'name': page['name'], 'scripts': page['scripts']} for page in pages],
    }
    subprocess.run(['node', str(ROOT / 'tools/compile-controllers.mjs')], input=json.dumps(specification), text=True, check=True)


def finalize_page(page, staged):
    """Attach the scene module without reordering the stylesheet cascade."""
    controller = Path('page-controllers') / (page['name'] + '.js')
    metadata = f'<meta name="forge-controller" content="{controller.as_posix()}?v={digest(staged / controller)}">'
    html = re.sub(r'</head\s*>', metadata + '</head>', page['html'])

    def mark_style(match):
        tag = match[0]
        href = re.search(r'href="([^"?]+)', tag)
        if href and href[1] not in SHARED_STYLES:
            return tag.replace('<link', '<link data-forge-page-style', 1)
        return tag

    html = re.sub(r'<link\b[^>]*\brel="stylesheet"[^>]*>', mark_style, html)
    html = html.replace('<style>', '<style data-forge-page-style>')

    def version(match):
        name = match[2]
        return f'{match[1]}="{name}?v={digest(staged / name)}"'

    html = re.sub(r'(src|href)="([^"?]+\.(?:mjs|js|css))(?:\?[^\"]*)?"', version, html)
    (staged / (page['name'] + '.html')).write_text(html)


def replace_output(staged, destination):
    """Publish a complete local build and recover if the final rename fails."""
    previous = None
    if destination.exists():
        backup = ROOT / '.build/previous'
        backup.mkdir(parents=True, exist_ok=True)
        previous = backup / str(time.time_ns())
        destination.rename(previous)
    try:
        staged.rename(destination)
    except BaseException:
        if previous is not None:
            previous.rename(destination)
        raise


def build(destination):
    destination = destination.resolve()
    validate_destination(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='portfolio-build-', dir=destination.parent) as temporary:
        staged = Path(temporary) / 'dist'
        shutil.copytree(ROOT / 'public', staged, ignore=shutil.ignore_patterns('.DS_Store'))
        copy_runtime_sources(staged)
        version_runtime_imports(staged)
        header = (ROOT / 'src/partials/forge-header.html').read_text()
        policy = POLICY.search((ROOT / 'src/pages/index.html').read_text())[2]
        pages = [prepare_page(file, header, policy) for file in sorted((ROOT / 'src/pages').glob('*.html'))]
        compile_controllers(staged, pages)
        for page in pages:
            finalize_page(page, staged)
        subprocess.run(['node', str(ROOT / 'tools/build-community.mjs'), str(staged / 'index.html')], check=True)
        (staged / '.nojekyll').touch()
        subprocess.run(['node', str(ROOT / 'tools/format-output.mjs'), str(staged)], check=True)
        replace_output(staged, destination)
    print(f'Built {sum(1 for path in destination.rglob("*") if path.is_file())} files in {destination}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    build(parser.parse_args().output)
