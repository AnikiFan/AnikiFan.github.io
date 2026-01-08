def define_env(env):
    import yaml
    with open("authors.yml", encoding="utf-8") as f:
        env.authors = yaml.safe_load(f)

    def author(id):
        a = env.authors[id]
        return f'<a href="{a["url"]}">{a["name"]}</a>'

    env.macro(author)
