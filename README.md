# MkDocs

## Get Started

```bash
uv sync
uv run mkdocs serve
```

The GitHub Actions workflow compiles `docs/assets/cv/cv.tex` to PDF and then deploys the site. Local previews will 404 the CV link until that PDF exists.

## Add an author

- Update `authors.yml`:
    - Use the name used in daily life as key

## Add a paper

- Template:
```markdown
!!! info ""
    ![<ABBR>](assets/images/paper/<YEAR>/<[VENUE_]YEAR>.png){ align=left width=40%}
    **<PAPER TITLE>**  
    <AUTHORS>  
    *<VENUEINFO>*  
    [[Paper]](<ARXIV OR OFFICIAL URL>) [[Code]](<GITHUB URL>) [[Project]](<URL>) [[BibTex]](<PREFER DBLP URL THAN GOOGLE SCHOLAR URL>)

    <div style="clear: both; height: 0; margin: 0; padding: 0;"></div>
    ??? abstract
        <ABSTRACT>
```
- 4 space per indent level.
- 2 space at the end of line equals newline.
- Referred authors should be registered in `authors.yml` and be referred as `{{ author("<KEY>") }}`

