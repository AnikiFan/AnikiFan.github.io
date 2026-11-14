/* Cached oil painting: bounded water ripples and small, masked canopy sways. */
(function () {
  "use strict";
  const hero = document.querySelector("[data-painting]");
  if (!hero) return;
  const image = hero.querySelector(".painting__image");
  const canvas = hero.querySelector(".painting__canvas");
  if (!image || !canvas) return;
  const context = canvas.getContext("2d", { alpha: true });
  const base = document.createElement("canvas");
  const brush = base.getContext("2d", { alpha: false });
  if (!context || !brush) return; // The native painting remains visible.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection;
  const constrained = () => reduced.matches || Boolean(connection &&
    (connection.saveData || /(^|-)2g$/.test(connection.effectiveType)));
  const mobile = matchMedia("(max-width: 767px)").matches;
  const budget = mobile ? 280000 : 550000;
  const interval = 1000 / (mobile ? 12 : 16);
  const waterline = Math.min(.95, Math.max(.1, Number(hero.dataset.waterline) || .55));
  let wanted = !constrained(), ready = false, visible = false, leaving = false;
  let frame = 0, previous = 0, time = 0, waterY = 0, loadVersion = 0;
  let press = null;
  const ripples = [];
  let trees = [];
  function active() { return ready && visible && !document.hidden && !leaving; }
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // The four contours follow tree crowns in the original artwork. The small
  // house on the right is excluded; all roots stop above the shoreline.
  const crowns = [
    [[0,.324],[.018,.318],[.029,.368],[.042,.325],[.058,.376],
      [.071,.365],[.091,.411],[.116,.397],[.151,.391],[.183,.414],[.22,.424]],
    [[.22,.428],[.244,.367],[.258,.36],[.275,.414],[.303,.414],
      [.324,.447],[.355,.439],[.385,.466],[.418,.472],[.443,.502]],
    [[.683,.49],[.715,.454],[.745,.438],[.779,.407],[.815,.413],
      [.835,.369],[.849,.408],[.867,.469]],
    [[.947,.437],[.956,.358],[.967,.344],[.975,.389],[.987,.412],[1,.406]]
  ];
  function cacheTrees(ratio, sx, sy) {
    trees = [];
    crowns.forEach((crown, index) => {
      const points = crown.map(([x, y]) => [
        (x * image.naturalWidth - sx) * ratio,
        (y * image.naturalHeight - sy) * ratio
      ]);
      const root = (image.naturalHeight * .535 - sy) * ratio;
      const left = Math.max(0, Math.floor(points[0][0] - 4));
      const top = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])) - 4));
      const right = Math.min(canvas.width, Math.ceil(points[points.length - 1][0] + 4));
      const bottom = Math.min(waterY, canvas.height, Math.ceil(root + 2));
      const w = right - left, h = bottom - top;
      if (w < 3 || h < 3) return; // Off-canvas trees, including portrait crops.
      const mask = document.createElement("canvas");
      const work = document.createElement("canvas");
      mask.width = work.width = w;
      mask.height = work.height = h;
      const ink = mask.getContext("2d");
      const layer = work.getContext("2d");
      if (!ink || !layer) return;
      // The blur is baked once, not a live full-frame effect.
      ink.filter = "blur(2px)";
      ink.fillStyle = "#fff";
      ink.beginPath();
      points.forEach(([x, y], i) => {
        if (i) ink.lineTo(x - left, y - top - 2);
        else ink.moveTo(x - left, y - top - 2);
      });
      ink.lineTo(points[points.length - 1][0] - left, root - top);
      ink.lineTo(points[0][0] - left, root - top);
      ink.closePath();
      ink.fill();
      trees.push({ x:left, y:top, w, h, mask, work, layer, phase:index * 1.37 });
    });
  }
  function paintTrees() {
    const amplitude = Math.min(1.5, canvas.width * .0016);
    for (const tree of trees) {
      const { x, y, w, h, work, layer, mask, phase } = tree;
      // Rebuild a fixed patch before warping, so there is no accumulating trail
      // or moving rectangular edge. The opaque inner patch covers old leaves.
      layer.clearRect(0, 0, w, h);
      layer.drawImage(base, x, y, w, h, 0, 0, w, h);
      const rows = Math.min(12, Math.ceil(h / 3));
      const slice = h / rows;
      const breeze = Math.sin(time * .48 + phase) + .28 * Math.sin(time * .91 + phase * 1.7);
      for (let row = 0; row < rows; row++) {
        const depth = (row + .5) / rows;
        const bend = smooth(0, .12, depth) * (1 - smooth(.42, .95, depth));
        const offset = amplitude * breeze * bend;
        const py = row * slice, height = Math.min(slice + 1, h - py);
        layer.drawImage(base, x, y + py, w, height, offset, py, w, height);
      }
      layer.globalCompositeOperation = "destination-in";
      layer.drawImage(mask, 0, 0);
      layer.globalCompositeOperation = "source-over";
      context.clearRect(x, y, w, h);
      context.drawImage(work, x, y);
    }
  }
  function paint() {
    paintTrees();
    const w = canvas.width, h = canvas.height, height = h - waterY;
    if (height < 1) return;
    // Restore just the water, not the whole landscape. Never read canvas pixels.
    context.drawImage(base, 0, waterY, w, height, 0, waterY, w, height);
    const strips = Math.min(48, Math.ceil(height / 3));
    const strip = height / strips;
    for (let row = 0; row < strips; row++) {
      const y = waterY + row * strip;
      const depth = (row + .5) / strips;
      const fade = Math.pow(Math.sin(Math.PI * depth), 1.6);
      let offset = (Math.sin(time * .55 + depth * 9) +
        .4 * Math.sin(time * .31 - depth * 17)) * Math.min(2.4, w * .003) * fade;
      for (const ripple of ripples) {
        const age = time - ripple.born;
        const distance = y - ripple.y * h;
        offset += Math.sin(distance * .12 - age * 7) *
          Math.exp(-distance * distance / 1800) * (1 - age / 3) * .65 * fade;
      }
      const slice = Math.min(strip + 1, h - y);
      context.drawImage(base, 0, y, w, slice, offset, y, w, slice);
    }
    // Short translucent brush-like arcs, rather than solid UI-style circles.
    context.save();
    context.beginPath();
    context.rect(0, waterY, w, height);
    context.clip();
    for (const ripple of ripples) {
      const age = time - ripple.born;
      const radius = (10 + age * 26) * Math.min(1.3, w / 600);
      const opacity = Math.pow(Math.max(0, 1 - age / 3), 2) * .16;
      context.strokeStyle = `rgba(231, 230, 198, ${opacity})`;
      context.lineWidth = Math.max(.7, w / 850);
      for (let arc = 0; arc < 6; arc++) {
        const angle = arc * Math.PI / 3 + ripple.phase;
        context.beginPath();
        context.ellipse(ripple.x * w, ripple.y * h, radius, radius * .22,
          0, angle, angle + .32);
        context.stroke();
      }
    }
    context.restore();
  }
  function resize() {
    if (!ready || !image.naturalWidth) return;
    const bounds = hero.getBoundingClientRect();
    const scale = Math.min(1, Math.sqrt(budget / Math.max(1, bounds.width * bounds.height)));
    const w = Math.max(1, Math.floor(bounds.width * scale));
    const h = Math.max(1, Math.floor(bounds.height * scale));
    if (canvas.width === w && canvas.height === h && base.dataset.source === image.currentSrc) return;
    canvas.width = base.width = w;
    canvas.height = base.height = h;
    const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / ratio, sh = h / ratio;
    const sx = (image.naturalWidth - sw) / 2, sy = (image.naturalHeight - sh) / 2;
    waterY = Math.max(0, Math.min(h, Math.ceil((image.naturalHeight * waterline - sy) * ratio)));
    brush.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
    base.dataset.source = image.currentSrc;
    cacheTrees(ratio, sx, sy);
    // Sky and hills remain transparent; the native painting supplies detail.
    context.clearRect(0, 0, w, h);
    if (wanted) paint();
    canvas.classList.add("is-ready");
  }
  function tick(now) {
    frame = 0;
    if (!active() || !wanted) return;
    const elapsed = now - previous;
    if (!previous || elapsed >= interval) {
      if (previous) time += Math.min(elapsed, 160) / 1000;
      previous = now;
      while (ripples.length && time - ripples[0].born >= 3) ripples.shift();
      paint();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    if (active() && wanted) frame = requestAnimationFrame(tick);
    else { ripples.length = 0; press = null; }
    if (ready && !wanted) context.clearRect(0, 0, canvas.width, canvas.height);
  }
  async function loaded() {
    const version = ++loadVersion;
    try { if (image.decode) await image.decode(); } catch (_) { /* Native load can still succeed. */ }
    if (version !== loadVersion || !image.complete || !image.naturalWidth) return;
    ready = true;
    resize();
    sync();
  }
  image.addEventListener("load", loaded);
  image.addEventListener("error", () => {
    loadVersion++;
    ready = false;
    canvas.classList.remove("is-ready");
    sync();
  });
  function addRipple(x, y) {
    if (!active() || !wanted) return;
    if (ripples.length === 3) ripples.shift();
    ripples.push({ x, y, born: time, phase: x * 8 });
  }
  hero.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("a, button")) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() };
  }, { passive: true });
  hero.addEventListener("pointerup", event => {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || !active() || !wanted ||
      event.target.closest("a, button") || performance.now() - start.at > 650 ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const bounds = hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (y <= waterY / canvas.height || y >= 1 || x < 0 || x > 1) return;
    addRipple(x, y);
  }, { passive: true });
  hero.addEventListener("pointercancel", () => { press = null; }, { passive: true });
  function preferences() {
    wanted = "IntersectionObserver" in window && !constrained();
    sync();
  }
  reduced.addEventListener("change", preferences);
  if (connection && connection.addEventListener) connection.addEventListener("change", preferences);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { leaving = true; sync(); });
  window.addEventListener("pageshow", () => { leaving = false; sync(); });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(hero);
  else window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .05;
      sync();
    }, { threshold: [0, .05] }).observe(hero);
  } else { visible = true; wanted = false; }
  if (image.complete && image.naturalWidth) loaded();
})();
