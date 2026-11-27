// Exercise loading and navigation without a browser, using a minimal DOM fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() {
    this.events = {}; this.dataset = {}; this.attributes = {}; this.children = [];
    const classes = new Set();
    this.classList = { remove: x => classes.delete(x), contains: x => classes.has(x),
      toggle: x => classes.has(x) ? classes.delete(x) : classes.add(x) };
  }
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
  emit(name, event = {}) { for (const fn of this.events[name] || []) fn(event); }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...children) { this.children = children; }
  append(child) { this.children.push(child); }
  remove() { this.removed = true; }
  querySelector(selector) { return selector === 'img' ? this.children[0] : this.nodes[selector]; }
  querySelectorAll() { return this.buttons; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
}
const tiers = ['standard', 'hd', 'full'];
const photos = ['first', 'second'].map(slug => ({slug, name: slug, date: '2026-11-21', rating: 4,
  variants: Object.fromEntries(tiers.map((tier, index) => [tier, {
    src: `${tier === 'full' ? 'https://nextcloud.xiaofan.ac.cn/' : ''}${tier}/${slug}.${tier === 'full' ? 'jpg' : 'webp'}`, width: 2560 + index * 1280, height: 1706, bytes: 1000000 * (index + 1)
  }]))}));
const links = photos.map(photo => Object.assign(new Element(), {href: `http://localhost/album/images/${photo.slug}.webp`, dataset: {photo: photo.slug}}));
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
  readyState: 'complete', body: new Element(), querySelector: () => album,
  createElement() {
    const d = new Element(); d.nodes = {};
    for (const selector of ['#australia-viewer-title','.australia-viewer-caption','.australia-viewer-status','.australia-viewer-image','.australia-download','.australia-previous','.australia-next','.australia-close']) d.nodes[selector] = new Element();
    d.buttons = tiers.map(tier => Object.assign(new Element(), {dataset: {quality: tier}}));
    dialogs.push(d); return d;
  }
};
vm.runInNewContext(fs.readFileSync(process.argv[2], 'utf8'), {
  document, URL, AbortController, Image: TestImage, console,
  fetch: async () => ({ok: true, json: async () => photos})
});
setImmediate(() => {
  const d = dialogs[0]; const click = {preventDefault() {this.prevented = true;}};
  assert.equal(requested.length, 0, 'Opening the page must not fetch large images');
  links[0].emit('click', click);
  assert.equal(click.prevented, true); assert.equal(d.open, true);
  assert.match(requested.at(-1), /standard\/first.webp$/);
  assert.equal(d.nodes['.australia-previous'].disabled, true);
  images.at(-1).onload();
  assert.match(d.nodes['.australia-viewer-status'].textContent, /标准/);
  d.buttons[1].emit('click');
  const oldLoad = images.at(-1).onload;
  assert.match(requested.at(-1), /hd\/first.webp$/);
  d.buttons[2].emit('click');
  assert.match(requested.at(-1), /full\/first.jpg$/);
  images.at(-1).onload(); oldLoad();
  assert.match(d.nodes['.australia-viewer-image'].children[0].src, /full\/first.jpg$/);
  assert.equal(d.nodes['.australia-download'].download, 'first-full.jpg');
  assert.match(d.nodes['.australia-viewer-status'].textContent, /全分辨率/);
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
});
