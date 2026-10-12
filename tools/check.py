"""Run the documented local/CI gates and stop on the first failing command."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(command):
    print('+ ' + ' '.join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


if __name__ == '__main__':
    for file in sorted((ROOT / 'src').rglob('*')):
        if file.suffix in {'.js', '.mjs'}:
            run(['node', '--check', str(file.relative_to(ROOT))])
    for file in sorted((ROOT / 'tests').glob('test-*')):
        if file.suffix == '.py':
            run([sys.executable, str(file.relative_to(ROOT))])
        elif file.suffix == '.mjs':
            run(['node', '--test', str(file.relative_to(ROOT))])
