# MkDocs

## Get Started

```bash
uv sync
uv run mkdocs serve
```

The GitHub Actions workflow compiles `docs/assets/cv/cv.tex` to PDF and then deploys the site. Local previews will 404 the CV link until that PDF exists.

The CV edition month is stored in `docs/assets/cv/version.txt` as `YYYY-MM`.
Update it when revising the CV. Both the homepage link and the PDF's subtle
bottom-right footer read this value, so rebuilding the site does not change the edition.

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

    ??? abstract
        <ABSTRACT>
```
- 4 space per indent level.
- 2 space at the end of line equals newline.
- Keep `??? abstract` inside the `!!! info` block as shown; the stylesheet automatically clears the floated image so the abstract spans the card's available width. No manual clearing element is needed.
- Referred authors should be registered in `authors.yml` and be referred as `{{ author("<KEY>") }}`
