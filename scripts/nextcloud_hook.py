"""Add generated photo albums to navigation and hide GitHub edit links."""
import json
from pathlib import Path


def on_config(config):
    manifest = Path(__file__).resolve().parents[1] / "build/nextcloud/nav.json"
    if manifest.exists():
        albums = json.loads(manifest.read_text(encoding="utf-8"))
        for section in config.nav:
            if isinstance(section, dict) and "Gallery" in section:
                section["Gallery"].extend({album["title"]: album["path"]} for album in albums)
    return config


def on_page_context(context, page, config, nav):
    if page.meta.get("nextcloud_content"):
        page.edit_url = None
    return context

