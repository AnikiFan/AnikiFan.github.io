import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from scripts.install_curated_albums import install, install_album


class CuratedAlbumTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.metadata = self.root / 'content/gallery/australia'
        self.metadata.mkdir(parents=True)
        (self.metadata / 'index.md').write_text('# 澳洲\n')
        variants = {tier: {'src': f'{tier}/test.webp', 'bytes': 5}
                    for tier in ('thumb', 'standard', 'hd')}
        variants['full'] = {'src': 'https://nextcloud.xiaofan.ac.cn/public.php/dav/files/test/full.jpg'}
        (self.metadata / 'quality.json').write_text(json.dumps([{'variants': variants}]))
        self.archive = self.root / 'web.zip'
        with zipfile.ZipFile(self.archive, 'w') as zipped:
            for tier in ('thumb', 'standard', 'hd'):
                zipped.writestr(f'{tier}/test.webp', b'image')
        self.album = {'slug': 'australia', 'title': '澳洲', 'count': 1, 'cover': 'test.webp',
                      'archive_url': 'https://nextcloud.xiaofan.ac.cn/web.zip',
                      'archive_sha256': hashlib.sha256(self.archive.read_bytes()).hexdigest(),
                      'archive_bytes': self.archive.stat().st_size}

    def test_install_merges_gallery_and_preserves_remote_full_resolution(self):
        (self.root / 'config').mkdir()
        (self.root / 'config/curated_albums.json').write_text(json.dumps([self.album]))
        (self.root / 'docs/gallery').mkdir(parents=True)
        (self.root / 'docs/gallery/index.md').write_text('# Gallery\n\nExisting album')
        (self.root / 'build/nextcloud').mkdir(parents=True)
        (self.root / 'build/nextcloud/nav.json').write_text('[{"title":"Existing","path":"existing.md"}]')
        install(self.root, self.root)
        destination = self.root / 'docs/gallery/albums/australia'
        self.assertEqual((destination / 'standard/test.webp').read_bytes(), b'image')
        self.assertFalse((destination / 'full').exists())
        self.assertIn('https://nextcloud', (destination / 'quality.json').read_text())
        self.assertIn('Existing album', (self.root / 'docs/gallery/index.md').read_text())
        self.assertEqual(len(json.loads((self.root / 'build/nextcloud/nav.json').read_text())), 2)

    def test_corrupt_download_never_installs(self):
        with self.archive.open('ab') as output:
            output.write(b'corruption')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            install_album(self.root, self.album, self.archive)
        self.assertFalse((self.root / 'docs/gallery/albums/australia').exists())

    def test_archive_cannot_add_unreviewed_files(self):
        with zipfile.ZipFile(self.archive, 'a') as zipped:
            zipped.writestr('../unexpected', b'bad')
        self.album['archive_sha256'] = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, 'contents'):
            install_album(self.root, self.album, self.archive)
        self.assertFalse((self.root / 'docs/gallery/albums/australia').exists())

    def test_name_collision_preserves_other_album(self):
        destination = self.root / 'docs/gallery/albums/australia'
        destination.mkdir(parents=True)
        (destination / 'existing.jpg').write_bytes(b'keep')
        with self.assertRaisesRegex(ValueError, 'collides'):
            install_album(self.root, self.album, self.archive)
        self.assertEqual((destination / 'existing.jpg').read_bytes(), b'keep')
