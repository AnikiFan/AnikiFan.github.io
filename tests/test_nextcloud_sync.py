import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import quote
import xml.etree.ElementTree as ET
from PIL import Image
from scripts.sync_nextcloud import DAV, DavSource, Entry, LocalSource, safe_path, sync

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "site"
        self.cloud = Path(self.tmp.name) / "cloud"
        self.root.mkdir()
        self.config = {"blog_folder": "博客", "gallery_folder": "图库"}
        self.post = self.cloud / "博客/2026-11-14-first/index.md"
        self.post.parent.mkdir(parents=True)
        self.post.write_text("# First post\n\nA useful observation.\n\n![Plot](plot.png)\n")
        Image.new("RGB", (100, 60), "blue").save(self.post.parent / "plot.png")
        self.album = self.cloud / "图库/Lake"
        self.album.mkdir(parents=True)
        exif = Image.Exif()
        exif[274] = 6
        exif[315] = "omit metadata from display copies"
        Image.new("RGB", (3000, 1800), "green").save(self.album / "Lake.jpg", exif=exif)
        (self.cloud / "草稿").mkdir()
        (self.cloud / "草稿/private.md").write_text("PRIVATE_DRAFT_SENTINEL")
        self.client = LocalSource(self.cloud)

    def run_sync(self, **kwargs):
        return sync(self.client, self.config, self.root, **kwargs)

    def test_blog_gallery_and_private_drafts(self):
        self.assertTrue(self.run_sync())
        post = self.root / "docs/blog/posts/nextcloud/2026-11-14-first/index.md"
        self.assertIn("created: 2026-11-14", post.read_text())
        self.assertIn("render_macros: false", post.read_text())
        self.assertTrue((post.parent / "plot.png").exists())
        self.assertNotIn("PRIVATE_DRAFT_SENTINEL", "".join(p.read_text() for p in self.root.rglob("*.md")))
        pictures = list((self.root / "docs/gallery/albums/lake/images").glob("*.webp"))
        self.assertEqual(len(pictures), 1)
        with Image.open(pictures[0]) as image:
            self.assertLessEqual(max(image.size), 2560)
            self.assertLess(image.width, image.height)
            self.assertFalse(image.getexif())
        with Image.open(pictures[0].parent.parent / "thumbs" / pictures[0].name) as image:
            self.assertLessEqual(max(image.size), 640)
        self.assertEqual(json.loads((self.root / "build/nextcloud/nav.json").read_text())[0]["path"],
                         "gallery/albums/lake/index.md")

    def test_unchanged_skip_and_stable_path_on_title_edit(self):
        self.run_sync()
        old = (self.root / "docs/nextcloud-content.sha256").read_text()
        self.assertFalse(self.run_sync(previous=old, skip_unchanged=True))
        self.post.write_text("# A revised title\n\nRevised content.\n")
        self.assertTrue(self.run_sync(previous=old, skip_unchanged=True))
        self.assertIn("Revised content", (self.root / "docs/blog/posts/nextcloud/2026-11-14-first/index.md").read_text())

    def test_deletion_preserves_existing_git_content(self):
        self.run_sync()
        existing = self.root / "docs/blog/posts/existing.md"
        existing.write_text("Existing GitHub content")
        self.post.unlink()
        (self.album / "Lake.jpg").unlink()
        self.run_sync()
        self.assertFalse((self.root / "docs/blog/posts/nextcloud/2026-11-14-first").exists())
        self.assertFalse((self.root / "docs/gallery/albums/lake").exists())
        self.assertEqual(existing.read_text(), "Existing GitHub content")

    def test_failure_preserves_last_good_snapshot(self):
        self.run_sync()
        marker = self.root / "docs/nextcloud-content.sha256"
        before = marker.read_text()
        with patch.object(self.client, "download", side_effect=RuntimeError("offline")):
            with self.assertRaises(RuntimeError):
                self.run_sync()
        self.assertEqual(marker.read_text(), before)

    def test_concurrent_edit_aborts(self):
        self.run_sync()
        entries = self.client.scan(["博客", "图库"])
        changed = dict(entries)
        name = next(iter(changed))
        changed[name] = Entry(name, "changed", 1, "")
        with patch.object(self.client, "scan", side_effect=[entries, changed]):
            with self.assertRaisesRegex(ValueError, "changed during sync"):
                self.run_sync()

    def test_missing_required_folder_aborts(self):
        self.run_sync()
        self.config["blog_folder"] = "missing"
        with self.assertRaises(ValueError):
            self.run_sync()
        self.assertTrue((self.root / "docs/blog/posts/nextcloud/2026-11-14-first/index.md").exists())

    def test_bad_metadata_aborts(self):
        self.post.write_text("---\ndate: not-a-date\n---\n# Broken")
        with self.assertRaises(ValueError):
            self.run_sync()

    def test_drafts_cannot_be_hidden_by_frontmatter_in_public_share(self):
        self.post.write_text("---\ndraft: true\n---\n# Draft")
        with self.assertRaisesRegex(ValueError, "public Published"):
            self.run_sync()

    def test_slug_collision_aborts(self):
        other = self.cloud / "博客/2026-11-14 first"
        other.mkdir()
        (other / "index.md").write_text("# Another post")
        with self.assertRaisesRegex(ValueError, "same URL slug"):
            self.run_sync()

    def test_symlink_aborts(self):
        (self.post.parent / "outside.md").symlink_to(self.cloud / "草稿/private.md")
        with self.assertRaisesRegex(ValueError, "Symlinks"):
            self.run_sync()

    def test_non_content_files_are_excluded(self):
        (self.post.parent / "private.txt").write_text("NOT_AN_ASSET")
        (self.post.parent / ".hidden.md").write_text("# Hidden")
        self.run_sync()
        self.assertFalse((self.root / "docs/blog/posts/nextcloud/2026-11-14-first/private.txt").exists())

class DavTests(unittest.TestCase):
    def setUp(self):
        self.client = DavSource({"dav_url": "https://cloud.example/public.php/dav/files/token/"})

    def listing(self, paths):
        root = ET.Element(DAV + "multistatus")
        for path, folder, status in paths:
            item = ET.SubElement(root, DAV + "response")
            ET.SubElement(item, DAV + "href").text = path
            ps = ET.SubElement(item, DAV + "propstat")
            ET.SubElement(ps, DAV + "status").text = "HTTP/1.1 " + status
            prop = ET.SubElement(ps, DAV + "prop")
            resource = ET.SubElement(prop, DAV + "resourcetype")
            if folder:
                ET.SubElement(resource, DAV + "collection")
            ET.SubElement(prop, DAV + "getetag").text = '"revision"'
            ET.SubElement(prop, DAV + "getcontentlength").text = "10"
        return ET.tostring(root)

    def test_unicode_listing(self):
        base = "/public.php/dav/files/token/" + quote("博客")
        xml = self.listing([(base + "/", True, "200 OK"), (base + "/" + quote("第一篇.md"), False, "200 OK")])
        with patch.object(self.client, "request", return_value=xml):
            self.assertEqual(self.client.scan(["博客"])["博客/第一篇.md"].etag, '"revision"')

    def test_invalid_responses(self):
        base = "/public.php/dav/files/token/" + quote("博客")
        listings = [[], [(base + "/", True, "403 Forbidden")],
                    [("/other/private.md", False, "200 OK")],
                    [("/public.php/dav/files/token/博客/../private.md", False, "200 OK")],
                    [("https://evil.example/public.php/dav/files/token/博客/x.md", False, "200 OK")]]
        for listing in listings:
            with patch.object(self.client, "request", return_value=self.listing(listing)):
                with self.assertRaises(ValueError):
                    self.client.children("博客")

    def test_download_pins_revision_and_checks_length(self):
        entry = Entry("博客/post.md", '"revision"', 3, "")
        with patch.object(self.client, "request", return_value=b"abc") as call:
            self.assertEqual(self.client.download(entry), b"abc")
            call.assert_called_once_with("博客/post.md", etag='"revision"')
        with patch.object(self.client, "request", return_value=b"wrong-size"):
            with self.assertRaises(ValueError):
                self.client.download(entry)

    def test_unsafe_paths(self):
        for path in ["../draft.md", "/draft.md", "Blog//x", "Blog/./x", "Blog\\x"]:
            with self.assertRaises(ValueError):
                safe_path(path)

if __name__ == "__main__":
    unittest.main()

