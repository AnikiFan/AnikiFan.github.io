// Exercise loading and navigation without a browser, using a minimal DOM fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() {
    this.events = {}; this.dataset = {}; this.attributes = {}; this.children = [];
    const classes = new Set();
    this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x),
      toggle: x => classes.has(x) ? classes.delete(x) : classes.add(x) };
  }
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
  emit(name, event = {}) { for (const fn of this.events[name] || []) fn(event); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; if (name === "href") delete this.href; }
  replaceChildren(...children) { this.children = children; }
  append(child) { this.children.push(child); }
  remove() { this.removed = true; }
  querySelector(selector) { return selector === 'img' ? this.children[0] : this.nodes[selector]; }
  querySelectorAll() { return this.buttons; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
}
function harness(options = {}) {
const tiers = ['standard', 'hd', 'full'];
const photos = ['first', 'second'].map(slug => ({slug, name: slug, date: '2026-11-21', rating: 4,
  variants: Object.fromEntries(tiers.map((tier, index) => [tier, {
    src: `${tier === 'full' ? 'https://nextcloud.xiaofan.ac.cn/' : ''}${tier}/${slug}.${tier === 'full' ? 'jpg' : 'webp'}`, width: 2560 + index * 1280, height: 1706, bytes: 1000000 * (index + 1), download: {src: `https://nextcloud.xiaofan.ac.cn/jpg/${tier}/${slug}.jpg`, bytes: 2000000 * (index + 1)}
  }]))}));
const links = photos.map(photo => Object.assign(new Element(), {href: `http://localhost/album/images/${photo.slug}.webp`, dataset: {photo: photo.slug}}));
links.forEach((link, index) => link.append(Object.assign(new Element(), options.thumbnails?.[index] || {complete: false, naturalWidth: 0})));
const album = {querySelectorAll: () => links};
const dialogs = [];
const images = [];
const requested = [];
class TestImage extends Element {
  constructor() { super(); images.push(this); }
  set src(value) { this.url = value; if (value) requested.push(value); }
  get src() { return this.url; }
}
const document = {
  getElementById: () => options.embedded ? {textContent: JSON.stringify(photos)} : null, readyState: 'complete', body: new Element(), querySelector: () => album,
  createElement() {
    const d = new Element(); d.nodes = {};
    for (const selector of ['#australia-viewer-title','.australia-viewer-caption','.australia-viewer-status','.australia-viewer-image','.australia-download','.australia-previous','.australia-next','.australia-close','.australia-viewer-counter','.australia-download-size','.australia-zoom','.australia-retry']) d.nodes[selector] = new Element();
    d.buttons = tiers.map(tier => Object.assign(new Element(), {dataset: {quality: tier}}));
    dialogs.push(d); return d;
  }
};
let fetchCalls = 0;
let fetchHandler = async () => ({ok: true, json: async () => photos});
vm.runInNewContext(fs.readFileSync(process.argv[2], 'utf8'), {
  document, URL, AbortController, Image: TestImage, console,
  fetch: (...args) => { fetchCalls++; return fetchHandler(...args); }
});
return {photos, links, dialogs, images, requested, get fetchCalls() {return fetchCalls;}, setFetch(fn) {fetchHandler = fn;}};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  {
    const {links} = harness({embedded: true, thumbnails: [{complete: true, naturalWidth: 640}, {complete: true, naturalWidth: 0}]});
    assert.equal(links[0].dataset.thumbnail, 'ready', 'Recognize cached thumbnails');
    assert.equal(links[1].dataset.thumbnail, 'error', 'Recognize failures before listeners attach');
    links[1].children[0].emit('load');
    assert.equal(links[1].dataset.thumbnail, 'ready');
    const pending = harness({embedded: true}).links[0];
    assert.equal(pending.dataset.thumbnail, 'loading');
    assert.equal(pending.attributes['aria-busy'], 'true');
    pending.children[0].emit('error');
    assert.equal(pending.dataset.thumbnail, 'error');
    assert.equal(pending.attributes['aria-busy'], 'false');
  }
  {
    const {links, dialogs, images, requested} = harness();
    await tick();

  const d = dialogs[0]; const click = {preventDefault() {this.prevented = true;}};
  assert.equal(requested.length, 0, 'Opening the page must not fetch large images');
  links[0].emit('click', click);
  assert.equal(click.prevented, true); assert.equal(d.open, true);
  assert.match(requested.at(-1), /standard\/first.webp$/);
  assert.match(d.nodes['.australia-download'].href, /jpg\/standard\/first.jpg$/);
  assert.equal(d.nodes['.australia-download'].download, 'first-standard.jpg');
  assert.equal(d.nodes['.australia-previous'].disabled, true);
  images.at(-1).onload();
  assert.match(d.nodes['.australia-viewer-status'].textContent, /标准/);
  d.buttons[1].emit('click');
  const oldLoad = images.at(-1).onload;
  assert.match(requested.at(-1), /hd\/first.webp$/);
  assert.match(d.nodes['.australia-download'].href, /jpg\/hd\/first.jpg$/);
  assert.equal(d.nodes['.australia-download'].download, 'first-hd.jpg');
  assert.equal(d.nodes['.australia-viewer-image'].children.length, 1, 'Keep the current photo visible during quality changes');
  d.buttons[2].emit('click');
  assert.match(requested.at(-1), /full\/first.jpg$/);
  images.at(-1).onload(); oldLoad();
  assert.match(d.nodes['.australia-viewer-image'].children[0].src, /full\/first.jpg$/);
  assert.equal(d.nodes['.australia-download'].download, 'first-full.jpg');
  assert.match(d.nodes['.australia-viewer-status'].textContent, /全分辨率/);
  d.nodes['.australia-zoom'].emit('click');
  assert.equal(d.nodes['.australia-zoom'].attributes['aria-pressed'], 'true');
  d.nodes['.australia-viewer-image'].emit('click');
  assert.equal(d.nodes['.australia-zoom'].attributes['aria-pressed'], 'false');
  d.nodes['.australia-next'].emit('click');
  assert.match(requested.at(-1), /full\/second.jpg$/);
  assert.equal(d.nodes['.australia-next'].disabled, true);
  const loadAfterClose = images.at(-1).onload;
  d.close(); loadAfterClose();
  assert.equal(d.nodes['.australia-viewer-image'].children.length, 0);
  assert.equal(requested.length, 4, 'No adjacent full-resolution photos are prefetched');
  const modifiedClick = {ctrlKey: true, preventDefault() {throw new Error('Modified click must remain native');}};
  links[0].emit('click', modifiedClick);
  assert.equal(d.open, false);
  console.log('PASS: lazy loading, all three tiers, download target, stale-load protection, navigation, close, native modified clicks');

  }

  // Clicking before metadata arrives must open the viewer immediately, not the image URL.
  {
    const h = harness();
    let resolve;
    h.setFetch(() => new Promise(done => {resolve = done;}));
    const click = {preventDefault() {this.prevented = true;}};
    h.links[0].emit('click', click);
    const d = h.dialogs[0];
    assert.equal(click.prevented, true);
    assert.equal(d.open, true);
    assert.equal(d.nodes['.australia-download'].attributes['aria-disabled'], 'true');
    assert.equal(h.requested.length, 0);
    await tick();
    h.links[1].emit('click', {preventDefault() {}});
    resolve({ok: true, json: async () => h.photos});
    await tick();
    assert.match(h.requested.at(-1), /standard\/second.webp$/);
    assert.match(d.nodes['.australia-download'].href, /standard\/second.jpg$/);
    assert.equal(d.nodes['.australia-download'].attributes['aria-disabled'], undefined);
  }
  // A transient request failure keeps the controls present and offers a working retry.
  {
    const h = harness();
    h.setFetch(async () => {throw new Error('simulated offline');});
    h.links[0].emit('click', {preventDefault() {}});
    await tick();
    const d = h.dialogs[0];
    assert.equal(d.open, true);
    assert.equal(d.nodes['.australia-retry'].hidden, false);
    assert.match(d.nodes['.australia-viewer-status'].textContent, /加载失败/);
    h.setFetch(async () => ({ok: true, json: async () => h.photos}));
    d.nodes['.australia-retry'].emit('click');
    await tick();
    assert.match(d.nodes['.australia-download'].href, /standard\/first.jpg$/);
    assert.equal(d.nodes['.australia-retry'].hidden, true);
  }
  // Embedded metadata is sufficient even if external metadata requests are unavailable.
  {
    const h = harness({embedded: true});
    h.setFetch(async () => {throw new Error('unexpected metadata request');});
    await tick();
    h.links[0].emit('click', {preventDefault() {}});
    assert.equal(h.fetchCalls, 0);
    assert.match(h.dialogs[0].nodes['.australia-download'].href, /standard\/first.jpg$/);
  }
  // A late response must not reopen a viewer the user has closed.
  {
    const h = harness();let resolve;
    h.setFetch(() => new Promise(done => {resolve = done;}));
    h.links[0].emit('click', {preventDefault() {}});
    await tick();h.dialogs[0].close();
    resolve({ok: true, json: async () => h.photos});
    await tick();
    assert.equal(h.dialogs[0].open, false);
    assert.equal(h.requested.length, 0);
  }
  console.log('PASS: early clicks, delayed metadata, retry after failure, embedded metadata, close while loading');
})().catch(error => {console.error(error); process.exitCode = 1;});
