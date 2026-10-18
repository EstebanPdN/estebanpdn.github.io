"""Render public port versions into static pages from one maintained registry.

Release availability is independent of development completion. Rendering happens
at build time so direct visits and animated navigation show the same metadata.
"""
from html import escape
import json
from pathlib import Path
import re

MARKER = re.compile(r'<!-- port-(status|release):\s*([a-z0-9-]+)(?:\s+(completed))?\s*-->')


def render_release_metadata(html, root):
    """Expand explicit release markers; reject unknown projects and bad records."""
    registry = json.loads((Path(root) / 'public/data/port-releases.json').read_text())

    def render(match):
        kind, project, completed = match.groups()
        entry = registry['ports'][project]
        stable = entry.get('stable')
        if stable and (not stable['version'].startswith('v') or not stable['url'].startswith('https://github.com/EstebanPdN/')):
            raise ValueError(f'Invalid stable release for {project}')
        if kind == 'status':
            label = ('Completed' if completed else 'Released') + ' · ' + stable['version'] if stable else 'In development · Unreleased'
            return escape(label)
        if stable:
            content = f'<a href="{escape(stable["url"], quote=True)}" target="_blank" rel="noreferrer">Stable release · {escape(stable["version"])}</a>'
            experimental = entry.get('experimental')
            if experimental:
                if not experimental['url'].startswith('https://github.com/EstebanPdN/'):
                    raise ValueError(f'Invalid experimental release for {project}')
                content += f'<a href="{escape(experimental["url"], quote=True)}" target="_blank" rel="noreferrer">Experimental · {escape(experimental["version"])}</a>'
        else:
            content = '<span>In development · No public release yet</span>'
        return f'<p class="port-release" data-port-release="{project}" aria-label="Public release status">{content}</p>'

    return MARKER.sub(render, html)
