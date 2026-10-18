"""Check release labels independently of page layout and development progress."""
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from port_releases import render_release_metadata


class PortReleaseTests(unittest.TestCase):
    def test_stable_and_experimental_channels_are_distinct(self):
        html = render_release_metadata('<!-- port-release: minish -->', ROOT)
        self.assertIn('Stable release · v2.1', html)
        self.assertIn('Experimental · v2.2-E1', html)
        self.assertIn('/releases/tag/v2.2-E1', html)

    def test_completion_does_not_hide_public_version(self):
        self.assertEqual(render_release_metadata('<!-- port-status: alttp completed -->', ROOT), 'Completed · v3.2')

    def test_unreleased_ports_do_not_borrow_upstream_versions(self):
        for project in ('sm64ds', 'dusklight', 'viper'):
            html = render_release_metadata(f'<!-- port-release: {project} -->', ROOT)
            self.assertIn('No public release yet', html)
            self.assertNotIn('<a ', html)

    def test_unknown_project_fails_the_build(self):
        with self.assertRaises(KeyError):
            render_release_metadata('<!-- port-release: unknown -->', ROOT)


if __name__ == '__main__':
    unittest.main()
