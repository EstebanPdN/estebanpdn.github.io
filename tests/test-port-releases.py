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
        self.assertIn('Stable release · v2.2', html)
        self.assertIn('Experimental · v2.2-E1', html)
        self.assertIn('/releases/tag/v2.2-E1', html)

    def test_completion_does_not_hide_public_version(self):
        self.assertEqual(render_release_metadata('<!-- port-status: alttp completed -->', ROOT), 'Completed · v4.0')

    def test_unreleased_ports_do_not_borrow_upstream_versions(self):
        for project in ('sm64ds', 'viper'):
            html = render_release_metadata(f'<!-- port-release: {project} -->', ROOT)
            self.assertIn('No public release yet', html)
            self.assertNotIn('<a ', html)

    def test_public_beta_links_its_local_page_without_claiming_a_release(self):
        html = render_release_metadata('<!-- port-release: dusklight -->', ROOT)
        self.assertIn('href="dusklight-beta-01.html"', html)
        self.assertIn('Public Beta 01', html)
        self.assertNotIn('Stable release', html)
        self.assertEqual(
            render_release_metadata('<!-- port-status: dusklight -->', ROOT),
            'In development · Public Beta 01',
        )

    def test_worms_beta_opens_its_installation_guide(self):
        html = render_release_metadata('<!-- port-release: worms -->', ROOT)
        self.assertIn('href="worms-3d.html#install"', html)
        self.assertIn('Public Beta 02', html)

    def test_unknown_project_fails_the_build(self):
        with self.assertRaises(KeyError):
            render_release_metadata('<!-- port-release: unknown -->', ROOT)


if __name__ == '__main__':
    unittest.main()
