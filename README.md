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
    <div class="paper-entry" markdown="1">
    <div class="paper-entry__image">
      <img src="assets/images/paper/<YEAR>/<[VENUE_]YEAR>.png" alt="<ABBR>" />
    </div>
    <div class="paper-entry__content" markdown="1">
    **<PAPER TITLE>**  
    <AUTHORS>  
    *<VENUEINFO>*  
    [[Paper]](<ARXIV OR OFFICIAL URL>) [[Code]](<GITHUB URL>) [[Project]](<URL>) [[BibTex]](<PREFER DBLP URL THAN GOOGLE SCHOLAR URL>)
    </div>
    </div>

    ??? abstract
        <ABSTRACT>
```
- 4 space per indent level.
- 2 space at the end of line equals newline.
- Keep `??? abstract` inside the `!!! info` block but outside `.paper-entry`; it spans the full card width below the image and paper metadata.
- The `.paper-entry` grid places the image on the left and metadata on the right. Images fill their grid column, preserve their aspect ratio, and are vertically centered when shorter than the metadata.
- Referred authors should be registered in `authors.yml` and be referred as `{{ author("<KEY>") }}`

## Add a project

- Template:
```markdown
!!! info ""
    <div class="project-entry">
    <a class="project-entry__image" href="projects/<SLUG>/">
      <img src="assets/images/projects/<IMAGE>" alt="<PROJECT NAME>" />
    </a>
    <div class="project-entry__content">
      <p><strong><a href="projects/<SLUG>/"><PROJECT NAME></a></strong></p>
      <p><SHORT DESCRIPTION></p>
      <p><em>Released: <MONTH YEAR></em></p>
      <p>
        <a href="projects/<SLUG>/">[Project page]</a>
        <a href="<GITHUB URL>">[GitHub]</a>
        <a href="<RELEASE OR SAMPLE URL>">[Release sample]</a>
      </p>
    </div>
    </div>
```
- The `.project-entry` grid uses the same image-column layout as publications: the image fills the left column, while the description and links remain on the right. The image keeps its aspect ratio and is vertically centered.
- Add the detailed project page under `docs/projects/<SLUG>.md` and register it in `mkdocs.yml` under `Projects`.
