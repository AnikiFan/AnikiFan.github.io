#!/usr/bin/env python3
"""Build website content from a dedicated, read-only Nextcloud public share.

Only the configured published blog/gallery folders are read. Source files are
never committed. A failed or changing snapshot aborts before publication.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, datetime
from email.utils import parsedate_to_datetime
import hashlib
import html
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
import xml.etree.ElementTree as ET

from PIL import Image, ImageOps
import yaml

IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
FILE_TYPES = IMAGE_TYPES | {".md", ".pdf"}
MAX_FILE_BYTES = 40 * 1024 * 1024
MAX_TOTAL_BYTES = 500 * 1024 * 1024
MAX_FILES = 2000
DAV = "{DAV:}"
Image.MAX_IMAGE_PIXELS = 90_000_000


@dataclass(frozen=True)
class Entry:
    path: str
    etag: str
    size: int
    modified: str


def safe_path(value: str) -> str:
    p = PurePosixPath(value)
    if not value or p.is_absolute() or any(x in {"", ".", ".."} for x in value.split("/")):
        raise ValueError("Unsafe content path")
    if "\\" in value or any(ord(x) < 32 for x in value):
        raise ValueError("Unsafe content path")
    return p.as_posix()


def visible(path: str) -> bool:
    return all(not part.startswith(".") or part.startswith(".attachments.")
               for part in PurePosixPath(path).parts)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Unexpected redirect from Nextcloud; check the configured DAV URL")


class DavSource:
    def __init__(self, config):
        url = config["dav_url"].rstrip("/") + "/"
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.username or parsed.query or parsed.fragment:
            raise ValueError("dav_url must be an HTTPS URL without credentials or query")
        self.base = url
        self.origin = (parsed.scheme, parsed.netloc)
        self.root = unquote(parsed.path)
        self.opener = build_opener(NoRedirect())

    def request(self, path, method="GET", etag=None):
        safe_path(path)
        headers = {"X-Requested-With": "XMLHttpRequest",
                   "User-Agent": "XiaoFan-Website-Content-Sync/1.0"}
        if method == "PROPFIND":
            headers.update({"Depth": "1", "Content-Type": "application/xml"})
        if etag:
            headers["If-Match"] = etag
        body = (b'<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop>'
                b'<d:resourcetype/><d:getetag/><d:getcontentlength/>'
                b'<d:getlastmodified/></d:prop></d:propfind>') if method == "PROPFIND" else None
        request = Request(self.base + quote(path, safe="/"), data=body,
                          headers=headers, method=method)
        for attempt in range(3):
            try:
                with self.opener.open(request, timeout=40) as response:
                    if method == "PROPFIND" and response.status != 207:
                        raise ValueError("Nextcloud did not return a DAV directory listing")
                    data = response.read(MAX_FILE_BYTES + 1)
                    if len(data) > MAX_FILE_BYTES:
                        raise ValueError("Nextcloud response exceeds the size limit")
                    return data
            except (HTTPError, URLError, TimeoutError) as exc:
                if isinstance(exc, HTTPError) and exc.code < 500:
                    raise RuntimeError(f"Nextcloud {method} failed (HTTP {exc.code})") from None
                if attempt == 2:
                    raise RuntimeError("Nextcloud is unavailable; the published website is unchanged") from None
                time.sleep(2 ** attempt)
        raise AssertionError("unreachable")

    def children(self, path):
        data = self.request(path, "PROPFIND")
        if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
            raise ValueError("Unexpected XML declaration")
        root = ET.fromstring(data)
        if root.tag != DAV + "multistatus":
            raise ValueError("Invalid DAV response")
        found_self = False
        children = []
        for item in root.findall(DAV + "response"):
            href = item.findtext(DAV + "href") or ""
            parsed = urlsplit(href)
            if parsed.netloc and (parsed.scheme, parsed.netloc) != self.origin:
                raise ValueError("DAV response points to another server")
            decoded = unquote(parsed.path)
            if not decoded.startswith(self.root):
                raise ValueError("DAV response points outside the published share")
            rel = decoded[len(self.root):].rstrip("/")
            safe_path(rel)
            prop = None
            for status in item.findall(DAV + "propstat"):
                if " 200 " in (status.findtext(DAV + "status") or ""):
                    prop = status.find(DAV + "prop")
                    break
            if prop is None:
                raise ValueError("Could not read properties for a published file")
            folder = prop.find(f"{DAV}resourcetype/{DAV}collection") is not None
            if rel == path:
                if not folder:
                    raise ValueError("A configured content folder is not a directory")
                found_self = True
                continue
            if str(PurePosixPath(rel).parent) != path:
                raise ValueError("DAV returned an unexpected descendant")
            children.append((rel, folder, prop))
        if not found_self:
            raise ValueError("DAV listing is incomplete")
        return children

    def scan(self, folders):
        files = {}
        visited = set()
        queue = list(folders)
        while queue:
            directory = queue.pop()
            if directory in visited or len(visited) > MAX_FILES:
                raise ValueError("Too many or duplicate directories")
            if len(PurePosixPath(directory).parts) > 12:
                raise ValueError("Content folder nesting exceeds the limit")
            visited.add(directory)
            for path, folder, prop in self.children(directory):
                if not visible(path):
                    continue
                if folder:
                    queue.append(path)
                elif PurePosixPath(path).suffix.lower() in FILE_TYPES:
                    etag = prop.findtext(DAV + "getetag") or ""
                    size = int(prop.findtext(DAV + "getcontentlength") or "-1")
                    if not etag or not 0 <= size <= MAX_FILE_BYTES:
                        raise ValueError("Missing file metadata or oversized file")
                    if path in files:
                        raise ValueError("Duplicate file in DAV response")
                    files[path] = Entry(path, etag, size, prop.findtext(DAV + "getlastmodified") or "")
                    if len(files) > MAX_FILES or sum(x.size for x in files.values()) > MAX_TOTAL_BYTES:
                        raise ValueError("Published content exceeds the configured size limit")
        return files

    def download(self, entry):
        data = self.request(entry.path, etag=entry.etag)
        if len(data) != entry.size:
            raise ValueError("File size changed during download")
        return data


class LocalSource:
    """Offline fixture source; never used by the deployed workflow."""
    def __init__(self, root):
        self.root = Path(root)

    def scan(self, folders):
        entries = {}
        for folder in folders:
            base = self.root / safe_path(folder)
            if not base.is_dir():
                raise ValueError(f"Required folder is missing: {folder}")
            for p in sorted(base.rglob("*")):
                if p.is_symlink():
                    raise ValueError("Symlinks are not supported")
                rel = p.relative_to(self.root).as_posix()
                if p.is_file() and visible(rel) and p.suffix.lower() in FILE_TYPES:
                    data = p.read_bytes()
                    entries[rel] = Entry(rel, hashlib.sha256(data).hexdigest(), len(data),
                                         datetime.fromtimestamp(p.stat().st_mtime).isoformat())
        return entries

    def download(self, entry):
        return (self.root / safe_path(entry.path)).read_bytes()


def fingerprint(entries, folders):
    payload = {"format": 1, "folders": folders,
               "files": [[e.path, e.etag, e.size] for e in sorted(entries.values(), key=lambda e: e.path)]}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def frontmatter(text):
    text = text.lstrip("\ufeff")
    meta = {}
    if text.startswith("---\n"):
        match = re.match(r"^---\n(.*?)\n---(?:\n|$)", text, re.S)
        if not match:
            raise ValueError("Unclosed article metadata")
        meta = yaml.safe_load(match.group(1)) or {}
        if not isinstance(meta, dict):
            raise ValueError("Article metadata must be a mapping")
        text = text[match.end():]
    return meta, text.strip()


def slug(value):
    value = re.sub(r"[^\w-]+", "-", value, flags=re.UNICODE).strip("-").lower()
    return value or "item"


def heading(body, fallback):
    match = re.search(r"^#\s+(.+)$", body, flags=re.M)
    return match.group(1).strip() if match else fallback


def created_date(meta, entry):
    value = meta.get("date")
    if isinstance(value, dict):
        value = value.get("created")
    if value:
        return date.fromisoformat(str(value)[:10])
    match = re.search(r"(?:^|/)(\d{4}-\d{2}-\d{2})(?:[-_/]|$)", entry.path)
    if match:
        return date.fromisoformat(match.group(1))
    try:
        return datetime.fromisoformat(entry.modified).date()
    except ValueError:
        return parsedate_to_datetime(entry.modified).date()


def write_markdown(path, meta, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("---\n" + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False)
                    + "---\n\n" + body.rstrip() + "\n", encoding="utf-8")


def make_blog(mirror, output, entries, folder):
    base = mirror / folder
    posts = []
    seen = set()
    # A blog post can be a top-level .md file or a folder containing index.md.
    for p in sorted(base.iterdir()):
        if p.is_dir() and visible(p.name):
            candidates = [x for x in p.glob("*.md") if visible(x.name)]
            if not candidates:
                continue
            if len(candidates) != 1:
                raise ValueError(f"Keep one article Markdown file in each blog folder: {p.name}")
            posts.append((candidates[0], p, p.name))
        elif p.is_file() and p.suffix.lower() == ".md":
            posts.append((p, None, p.stem))
    for article, asset_dir, identifier in posts:
        entry = entries[article.relative_to(mirror).as_posix()]
        meta, body = frontmatter(article.read_text(encoding="utf-8"))
        if meta.get("draft"):
            raise ValueError("Move drafts out of the public Published folder before syncing")
        post_slug = slug(identifier)
        if post_slug in seen:
            raise ValueError("Two articles have the same URL slug")
        seen.add(post_slug)
        title = str(meta.get("title") or heading(body, identifier))
        allowed = {k: v for k, v in meta.items() if k in {"description", "categories", "tags"}}
        allowed.update({"title": title, "date": {"created": created_date(meta, entry)},
                        "slug": post_slug, "render_macros": False, "nextcloud_content": True})
        if not re.search(r"^#\s", body, re.M):
            body = "# " + title + "\n\n" + body
        if "<!-- more -->" not in body:
            pieces = body.split("\n\n", 2)
            body = "\n\n".join(pieces[:2]) + "\n\n<!-- more -->\n\n" + "\n\n".join(pieces[2:])
        target = output / post_slug
        target.mkdir(parents=True)
        if asset_dir:
            for asset in asset_dir.rglob("*"):
                if asset.is_file() and asset.suffix.lower() != ".md":
                    dest = target / asset.relative_to(asset_dir)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(asset, dest)
        write_markdown(target / "index.md", allowed, body)
    return len(posts)


def gallery_image(source, target):
    # Produce display images and thumbnails with corrected orientation, without EXIF.
    with Image.open(source) as opened:
        picture = ImageOps.exif_transpose(opened).convert("RGB")
        picture.thumbnail((2560, 2560))
        target.parent.mkdir(parents=True, exist_ok=True)
        picture.save(target, "WEBP", quality=88)
        picture.thumbnail((640, 640))
        thumb = target.parent.parent / "thumbs" / target.name
        thumb.parent.mkdir(parents=True, exist_ok=True)
        picture.save(thumb, "WEBP", quality=82)
    return thumb


def make_gallery(mirror, output, folder):
    base = mirror / folder
    albums = []
    groups = [(p, p.name) for p in sorted(base.iterdir()) if p.is_dir() and visible(p.name)]
    if any(p.suffix.lower() in IMAGE_TYPES for p in base.iterdir() if p.is_file()):
        groups.insert(0, (base, "photos"))
    seen = set()
    for directory, identifier in groups:
        images = sorted(p for p in (directory.glob("*") if directory == base else directory.rglob("*"))
                        if p.is_file() and p.suffix.lower() in IMAGE_TYPES)
        if not images:
            continue
        album_slug = slug(identifier)
        if album_slug in seen:
            raise ValueError("Two photo albums have the same URL slug")
        seen.add(album_slug)
        description = directory / "index.md"
        meta, body = frontmatter(description.read_text(encoding="utf-8")) if description.exists() else ({}, "")
        title = str(meta.get("title") or heading(body, identifier))
        if not body:
            body = "# " + title
        target = output / album_slug
        figures = []
        cover = ""
        for image in images:
            label = image.stem
            suffix = hashlib.sha256(image.relative_to(directory).as_posix().encode()).hexdigest()[:10]
            filename = slug(image.stem) + "-" + suffix + ".webp"
            gallery_image(image, target / "images" / filename)
            cover = cover or filename
            # Markdown links are resolved by MkDocs; lightbox uses the display image.
            figures.append('<figure markdown="1">\n'
                           f'[![{html.escape(label, quote=True).replace("[", "&#91;").replace("]", "&#93;")}]'
                           f'(thumbs/{quote(filename)}){{ loading=lazy }}](images/{quote(filename)})'
                           '{ .glightbox data-type="image" }\n'
                           f'<figcaption>{html.escape(label)}</figcaption>\n</figure>')
        body += '\n\n<div class="photo-grid" markdown="1">\n\n' + "\n\n".join(figures) + "\n\n</div>"
        write_markdown(target / "index.md", {"title": title, "render_macros": False,
                                           "nextcloud_content": True}, body)
        albums.append({"title": title, "slug": album_slug, "cover": cover, "count": len(images)})
    return albums


def apply_snapshot(source, config, root, entries, digest):
    build = root / "build/nextcloud"
    build.mkdir(parents=True, exist_ok=True)
    folders = [config["blog_folder"], config["gallery_folder"]]
    with tempfile.TemporaryDirectory(prefix="snapshot-", dir=build) as temporary:
        stage = Path(temporary)
        mirror = stage / "source"
        for folder in folders:
            (mirror / safe_path(folder)).mkdir(parents=True)
        for entry in entries.values():
            dest = mirror / safe_path(entry.path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(source.download(entry))
        if fingerprint(source.scan(folders), folders) != digest:
            raise ValueError("Nextcloud changed during sync; retry on the next run")
        blog = stage / "blog"
        gallery = stage / "gallery"
        blog.mkdir()
        gallery.mkdir()
        count = make_blog(mirror, blog, entries, config["blog_folder"])
        albums = make_gallery(mirror, gallery, config["gallery_folder"])
        intro = "# Gallery\n\nPhotographs, places, and moments.\n"
        if albums:
            intro += '\n<div class="photo-grid" markdown="1">\n\n'
            for a in albums:
                name = html.escape(a["title"]).replace("[", "&#91;").replace("]", "&#93;")
                intro += (f'<figure markdown="1">\n[![{name}]'
                          f'(albums/{quote(a["slug"])}/thumbs/{quote(a["cover"])}){{ loading=lazy }}]'
                          f'(albums/{quote(a["slug"])}/index.md)\n'
                          f'<figcaption>{html.escape(a["title"])} · {a["count"]} photos</figcaption>\n'
                          '</figure>\n\n')
            intro += "</div>\n"
        else:
            intro += "\nNew photo collections will appear here.\n"
        # Replace only generated folders, after the complete snapshot was validated.
        for generated, destination in [(blog, root / "docs/blog/posts/nextcloud"),
                                        (gallery, root / "docs/gallery/albums")]:
            if destination.exists():
                shutil.rmtree(destination)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(generated, destination)
        write_markdown(root / "docs/gallery/index.md", {"render_macros": False}, intro)
        nav = [{"title": a["title"], "path": f'gallery/albums/{a["slug"]}/index.md'} for a in albums]
        (build / "nav.json").write_text(json.dumps(nav, ensure_ascii=False), encoding="utf-8")
        (root / "docs/nextcloud-content.sha256").write_text(digest + "\n")
    return count, len(albums)


def sync(source, config, root, previous="", skip_unchanged=False):
    folders = [safe_path(config["blog_folder"]), safe_path(config["gallery_folder"])]
    entries = source.scan(folders)
    digest = fingerprint(entries, folders)
    if skip_unchanged and digest == previous.strip():
        return False
    posts, albums = apply_snapshot(source, config, root, entries, digest)
    print(f"Prepared {posts} Nextcloud posts and {albums} photo albums.")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--local-source", type=Path, help="Offline fixture directory")
    parser.add_argument("--previous-hash", type=Path)
    parser.add_argument("--skip-unchanged", action="store_true")
    args = parser.parse_args()
    config = json.loads((args.root / "config/nextcloud.json").read_text(encoding="utf-8"))
    source = LocalSource(args.local_source) if args.local_source else DavSource(config)
    previous = args.previous_hash.read_text().strip() if args.previous_hash and args.previous_hash.exists() else ""
    changed = sync(source, config, args.root, previous, args.skip_unchanged)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as out:
            out.write(f"changed={'true' if changed else 'false'}\n")
    print("Content prepared for build." if changed else "Published content is unchanged; deployment skipped.")


if __name__ == "__main__":
    main()

