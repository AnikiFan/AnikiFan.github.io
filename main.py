from pathlib import Path

import yaml


def define_env(env):
    authors_path = Path(__file__).with_name("authors.yml")
    with authors_path.open(encoding="utf-8") as f:
        env.authors = yaml.safe_load(f) or {}

    def author(author_id: str) -> str:
        data = env.authors.get(author_id)
        if not data:
            return author_id

        name = data.get("name", author_id)
        url = data.get("url")
        if not url:
            return name
        return f'<a href="{url}" target="_blank" rel="noopener">{name}</a>'

    env.macro(author)
