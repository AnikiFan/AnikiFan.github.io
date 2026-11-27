"""Restore reviewed albums after Nextcloud sync; full-size JPEGs stay on Nextcloud."""
import argparse
import hashlib
import html
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
from urllib.parse import urlsplit
from urllib.request import urlopen
import zipfile

MAX_ARCHIVE = 250 * 1024 * 1024
MAX_EXPANDED = 400 * 1024 * 1024


def install_album(root, album, archive):
    slug = album['slug']
    if not re.fullmatch(r'[a-z0-9-]+', slug):
        raise ValueError('Invalid album slug')
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != album['archive_sha256']:
            raise ValueError('Album archive checksum mismatch')
    metadata = root / 'content/gallery' / slug
    photos = json.loads((metadata / 'quality.json').read_text())
    if len(photos) != album['count']:
        raise ValueError('Album photo count mismatch')
    expected = {photo['variants'][tier]['src']: photo['variants'][tier]['bytes']
                for photo in photos for tier in ('thumb', 'standard', 'hd')}
    for name in expected:
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or '\\' in name:
            raise ValueError('Unsafe media path')
    for photo in photos:
        url = urlsplit(photo['variants']['full']['src'])
        if url.scheme != 'https' or url.netloc != 'nextcloud.xiaofan.ac.cn' or url.username:
            raise ValueError('Full-resolution images must use the public Nextcloud host')
        for tier in ('standard', 'hd', 'full'):
            download = photo['variants'][tier]['download']
            url = urlsplit(download['src'])
            if (url.scheme != 'https' or url.netloc != 'nextcloud.xiaofan.ac.cn'
                    or url.username or not url.path.lower().endswith('.jpg')
                    or download['bytes'] <= 0):
                raise ValueError('Every quality tier must provide a public JPG download')
    destination = root / 'docs/gallery/albums' / slug
    if destination.exists():
        raise ValueError('Curated album collides with a Nextcloud album')
    with tempfile.TemporaryDirectory(prefix='curated-') as temporary:
        stage = Path(temporary)
        with zipfile.ZipFile(archive) as zipped:
            entries = zipped.infolist()
            if len(entries) != len(expected) or {x.filename for x in entries} != set(expected):
                raise ValueError('Archive contents do not match the album manifest')
            if sum(x.file_size for x in entries) > MAX_EXPANDED:
                raise ValueError('Expanded album exceeds size limit')
            for entry in entries:
                if entry.file_size != expected[entry.filename]:
                    raise ValueError('Media size mismatch')
                target = stage / entry.filename
                target.parent.mkdir(parents=True, exist_ok=True)
                with zipped.open(entry) as source, target.open('wb') as output:
                    shutil.copyfileobj(source, output)
        for name in ('index.md', 'quality.json'):
            shutil.copyfile(metadata / name, stage / name)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(stage, destination)


def install(root, archive_dir=None):
    albums = json.loads((root / 'config/curated_albums.json').read_text())
    nav_path = root / 'build/nextcloud/nav.json'
    nav = json.loads(nav_path.read_text()) if nav_path.exists() else []
    for album in albums:
        url = urlsplit(album['archive_url'])
        if url.scheme != 'https' or url.netloc != 'nextcloud.xiaofan.ac.cn' or url.username:
            raise ValueError('Album archive must use the public Nextcloud host')
        with tempfile.TemporaryDirectory(prefix='album-download-') as temporary:
            archive = Path(temporary) / 'album.zip'
            if archive_dir:
                shutil.copyfile(archive_dir / PurePosixPath(url.path).name, archive)
            else:
                total = 0
                with urlopen(album['archive_url'], timeout=180) as response, archive.open('wb') as output:
                    while chunk := response.read(1024 * 1024):
                        total += len(chunk)
                        if total > MAX_ARCHIVE:
                            raise ValueError('Album download exceeds size limit')
                        output.write(chunk)
            if archive.stat().st_size != album['archive_bytes']:
                raise ValueError('Incomplete album archive')
            install_album(root, album, archive)
        slug = album['slug']
        title = html.escape(album['title'])
        page = root / 'docs/gallery/index.md'
        intro = page.read_text().replace('New photo collections will appear here.\n', '')
        intro += (f'\n<div class="photo-grid" markdown="1">\n\n<figure markdown="1">\n'
                  f'[![{title}](albums/{slug}/thumbs/{album["cover"]}){{ loading=lazy }}]'
                  f'(albums/{slug}/index.md)\n<figcaption>{title} · {album["count"]} photos</figcaption>\n'
                  '</figure>\n\n</div>\n')
        page.write_text(intro)
        nav.append({'title': album['title'], 'path': f'gallery/albums/{slug}/index.md'})
        print(f'Installed reviewed album: {album["title"]} ({album["count"]} photos)')
    nav_path.parent.mkdir(parents=True, exist_ok=True)
    nav_path.write_text(json.dumps(nav, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--archive-dir', type=Path, help='Use already downloaded archives for offline verification')
    args = parser.parse_args()
    install(args.root, args.archive_dir)
