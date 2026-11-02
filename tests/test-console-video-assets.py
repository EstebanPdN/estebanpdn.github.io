"""Verify that mobile playback never needs to crop a paired recording in an SVG."""
from pathlib import Path
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
source = (root / 'src/features/collection/dual.js').read_text()
files = sorted(set(re.findall(r"'(captures/[^']+\.mp4)'", source)))
assert len(files) == 5
for name in files:
    paired = root / 'public/assets' / name
    durations, scales = [], set()
    for side, width in [('top', 400), ('bottom', 320)]:
        path = paired.with_name(paired.stem + '-' + side + '.mp4')
        metadata = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)
        ]))
        stream = metadata['streams'][0]
        assert len(metadata['streams']) == 1, f'{path}: unexpected audio track'
        scale = stream['height'] // 240
        assert scale in (1, 2) and (stream['width'], stream['height']) == (width * scale, 240 * scale), path
        scales.add(scale)
        assert stream['sample_aspect_ratio'] == '1:1', path
        durations.append(float(metadata['format']['duration']))
    assert len(scales) == 1, f'{name}: mismatched pair scale'
    assert abs(durations[0] - durations[1]) < .04, name
print('PASS: five synchronized pairs, separate 400×240 / 320×240 frames (or 2×), square pixels, no audio.')
