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

## Homepage beach cover

`overrides/home.html`, `docs/stylesheets/extra.css`, and
`docs/javascripts/beach.js` implement the cover. Media sources and license links
are recorded in [MEDIA_CREDITS.md](MEDIA_CREDITS.md).

- The responsive WebP poster loads first, including with JavaScript disabled.
- Only one silent 24 fps H.264 video is selected per visit: a portrait crop below
  768 CSS pixels, or the landscape version otherwise. Resizing does not fetch
  another video. Both MP4s use fast-start metadata and a short crossfaded loop.
- Reduced-motion, Save-Data, and reported 2G connections start with a still
  image. Play waves allows an explicit opt-in. No video URL is attached before
  it is needed. Browsers that block autoplay retain the poster and play button.
- Ocean audio is independent of motion, initially off, and fetched only after
  the sound button is clicked. Both players pause when the cover leaves view,
  the document is hidden, or the page is left. They resume according to the
  visitor's choices when visible again; choices are not persisted across visits.
- No animation library, canvas, WebGL renderer, or continuous JavaScript loop
  is used. Media decode and playback remain native browser operations.

After changing the cover, run `uv run mkdocs build --strict`, serve `site/`, and
check desktop, narrow mobile, and landscape mobile layouts. Verify play/pause,
sound on/off, scroll-away and background-tab suspension, reduced-motion and
Save-Data opt-in, media-load failures, and the no-JavaScript poster. Audio must
not be requested before a click, and only one MP4 should be requested per visit.
