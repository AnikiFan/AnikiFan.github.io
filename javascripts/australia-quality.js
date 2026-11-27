/* The album loads thumbnails first; larger variants load only on selection. */
(() => {
  let dispose = () => {};
  async function setup() {
    dispose();
    const album = document.querySelector('.australia-album');
    if (!album) return;
    const controller = new AbortController();
    let dialog;
    dispose = () => {
      controller.abort();
      if (dialog?.open) dialog.close();
      dialog?.remove();
    };
    const links = [...album.querySelectorAll('a.australia-open')];
    if (!links.length) return;
    const manifestURL = new URL('../quality.json', links[0].href);
    let photos;
    try {
      const response = await fetch(manifestURL, { signal: controller.signal });
      if (!response.ok) throw new Error('Album variants unavailable');
      const manifest = await response.json();
      const bySlug = new Map(manifest.map(photo => [photo.slug, photo]));
      photos = links.map(link => bySlug.get(link.dataset.photo));
      if (photos.some(photo => !photo)) throw new Error('Incomplete album variants');
    } catch (error) {
      if (error.name !== 'AbortError') console.warn('Quality viewer unavailable; image links remain usable.', error);
      return;
    }
    if (controller.signal.aborted) return;
    dialog = document.createElement('dialog');
    dialog.className = 'australia-viewer';
    dialog.setAttribute('aria-labelledby', 'australia-viewer-title');
    dialog.innerHTML = `
      <header class="australia-viewer-header">
        <div><h2 id="australia-viewer-title"></h2><p class="australia-viewer-caption"></p></div>
        <button type="button" class="australia-close" aria-label="关闭照片">关闭 ×</button>
      </header>
      <div class="australia-viewer-tools">
        <div class="australia-quality" role="group" aria-label="照片画质">
          <button type="button" data-quality="standard" aria-pressed="true">标准</button>
          <button type="button" data-quality="hd" aria-pressed="false">高清</button>
          <button type="button" data-quality="full" aria-pressed="false">全分辨率</button>
        </div>
        <a class="australia-download" download>下载此画质</a>
      </div>
      <p class="australia-viewer-status" role="status" aria-live="polite"></p>
      <div class="australia-viewer-image" tabindex="0" role="region" aria-label="照片，点击可切换实际像素查看"></div>
      <footer class="australia-viewer-footer">
        <button type="button" class="australia-previous" aria-label="上一张照片">← 上一张</button>
        <span class="australia-viewer-help">点击图片查看实际像素 · Esc 关闭</span>
        <button type="button" class="australia-next" aria-label="下一张照片">下一张 →</button>
      </footer>`;
    document.body.append(dialog);
    const find = selector => dialog.querySelector(selector);
    const title = find('#australia-viewer-title');
    const caption = find('.australia-viewer-caption');
    const status = find('.australia-viewer-status');
    const viewport = find('.australia-viewer-image');
    const download = find('.australia-download');
    const previous = find('.australia-previous');
    const next = find('.australia-next');
    const qualityButtons = [...dialog.querySelectorAll('[data-quality]')];
    const labels = { standard: '标准', hd: '高清', full: '全分辨率' };
    let index = 0;
    let quality = 'standard';
    let request = 0;
    let pending = null;
    const stopLoading = () => {
      request++;
      if (pending) {
        pending.onload = null;
        pending.onerror = null;
        pending.src = '';
        pending = null;
      }
    };
    function show() {
      stopLoading();
      const ticket = request;
      const photo = photos[index];
      const variant = photo.variants[quality];
      const src = new URL(variant.src, manifestURL).href;
      const size = variant.bytes >= 1048576
        ? `${(variant.bytes / 1048576).toFixed(1)} MB`
        : `${Math.round(variant.bytes / 1024)} KB`;
      const detail = `${labels[quality]} · ${variant.width} × ${variant.height} · ${size}`;
      title.textContent = photo.name;
      caption.textContent = `${photo.date} · ${photo.rating} 星 · ${index + 1} / ${photos.length}`;
      status.textContent = `正在加载 ${detail}`;
      download.href = src;
      download.download = `${photo.name}-${quality}.${quality === 'full' ? 'jpg' : 'webp'}`;
      previous.disabled = index === 0;
      next.disabled = index === photos.length - 1;
      qualityButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.quality === quality)));
      viewport.classList.remove('is-zoomed');
      viewport.replaceChildren();
      const img = new Image();
      pending = img;
      img.alt = `${photo.date} · ${photo.name}`;
      img.decoding = 'async';
      img.onload = () => {
        if (ticket !== request || !dialog.open) return;
        pending = null;
        viewport.replaceChildren(img);
        status.textContent = detail + (quality === 'full' ? ' · 高质量 JPEG' : ' · WebP');
      };
      img.onerror = () => {
        if (ticket !== request || !dialog.open) return;
        pending = null;
        status.textContent = '图片加载失败，请切换画质重试，或使用下载链接。';
      };
      img.src = src;
    }
    function move(offset) {
      const target = index + offset;
      if (target < 0 || target >= photos.length) return;
      index = target;
      show();
    }
    links.forEach((link, position) => link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      index = position;
      dialog.showModal();
      show();
    }, { signal: controller.signal }));
    qualityButtons.forEach(button => button.addEventListener('click', () => {
      quality = button.dataset.quality;
      show();
    }));
    find('.australia-close').addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    const toggleZoom = () => {
      if (viewport.querySelector('img')) viewport.classList.toggle('is-zoomed');
    };
    viewport.addEventListener('click', toggleZoom);
    viewport.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleZoom();
      }
    });
    dialog.addEventListener('keydown', event => {
      if (viewport.classList.contains('is-zoomed')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    dialog.addEventListener('close', () => {
      stopLoading();
      viewport.replaceChildren();
    });
  }
  if (typeof document$ !== 'undefined') document$.subscribe(setup);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
