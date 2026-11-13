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

The beach is rendered in real time by an original WebGL fragment shader in
`docs/javascripts/beach.js`. There is no video, photograph, texture download,
audio file, or animation framework in the cover. `overrides/home.html` supplies
the canvas and controls; `docs/stylesheets/extra.css` supplies layout and the
CSS-only fallback.

The deliberately dreamlike shader uses blue and periwinkle water, broad moving
swells, a feathered shoreline, diffuse reflected light, a lavender sky, and
atmospheric haze. Perspective-scaled noise provides motion without sharp normal
reflections, dense foam, or a hard horizon. Softness is calculated directly in
the shader, without a full-screen blur or post-processing pass. This is an
atmospheric illustration rather than a fluid-dynamics simulation.

- One fullscreen triangle, no texture allocations or post-processing passes.
- Initial drawing-buffer budgets: 460,000 pixels on desktop, 230,000 on mobile;
  device pixel ratio is not multiplied in. Target caps are 24 and 20 fps.
  Repeated slow frames lower the pixel budget down to 90,000 pixels. Actual
  performance depends on the browser and GPU; the limits are not an FPS guarantee.
- Reduced-motion, Save-Data, and reported 2G connections render a single still
  frame by default. Play waves allows an explicit opt-in. Pausing or leaving
  the cover/tab stops the animation loop; returning preserves the scene time.
- No WebGL or JavaScript: a CSS beach remains visible. Context loss stops the
  loop and exposes the fallback; restoration rebuilds GPU resources.
- Sound is off by default. The first sound-button click creates a Web Audio
  graph from deterministic filtered noise and slow amplitude/filter modulation.
  This synthesizes surf rather than playing a recording. It is independent of
  visual motion, and the audio context is suspended offscreen or in a hidden
  tab. No sound generation runs before opt-in.

After changes, run `uv run mkdocs build --strict` and check desktop, narrow
mobile, and landscape layouts. Verify animation and audio controls, offscreen
and background suspension, reduced-motion/Save-Data opt-in, resizing, WebGL
failure and context restoration, and the no-JavaScript fallback. Network
inspection should show no cover media requests. Browser automation with a
software WebGL renderer validates behavior, not real-device GPU performance.
