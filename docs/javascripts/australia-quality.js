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
    // Reserve space in the HTML, then reflect both cached and later image results.
    for (const link of links) {
      const thumbnail = link.querySelector('img');
      if (!thumbnail) continue;
      const state = value => {
        link.dataset.thumbnail = value;
        link.setAttribute('aria-busy', String(value === 'loading'));
      };
      thumbnail.addEventListener('load', () => state('ready'), { signal: controller.signal });
      thumbnail.addEventListener('error', () => state('error'), { signal: controller.signal });
      state(thumbnail.complete ? (thumbnail.naturalWidth > 0 ? 'ready' : 'error') : 'loading');
    }
    const manifestURL = new URL('../quality.json', links[0].href);
    manifestURL.searchParams.set('v', '3');
    let photos = null;
    let loading = null;
    dialog = document.createElement('dialog');
    dialog.className = 'australia-viewer';
    dialog.setAttribute('aria-labelledby', 'australia-viewer-title');
    const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    dialog.innerHTML = `
      <header class="australia-viewer-header">
        <div class="australia-viewer-heading"><span class="australia-viewer-eyebrow">2026 澳洲</span><h2 id="australia-viewer-title"></h2><p class="australia-viewer-caption"></p></div>
        <div class="australia-viewer-actions">
          <button type="button" class="australia-zoom australia-icon-button" aria-label="查看实际像素" aria-pressed="false" title="查看实际像素">${icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4M8 10.5h5m-2.5-2.5v5"/>')}</button>
          <button type="button" class="australia-close australia-icon-button" aria-label="关闭照片" title="关闭 · Esc" autofocus>${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button>
        </div>
      </header>
      <div class="australia-viewer-image" tabindex="0" role="region" aria-label="照片，点击可切换实际像素查看"></div>
      <div class="australia-viewer-meta">
        <p class="australia-viewer-status" role="status" aria-live="polite"></p>
        <button type="button" class="australia-retry" hidden>重新加载</button>
        <span class="australia-viewer-help">点击放大 · 方向键切换</span>
      </div>
      <footer class="australia-viewer-footer">
        <nav class="australia-viewer-navigation" aria-label="切换照片">
          <button type="button" class="australia-previous australia-icon-button" aria-label="上一张照片" title="上一张">${icon('<path d="m14 6-6 6 6 6"/>')}</button>
          <span class="australia-viewer-counter" aria-label="当前照片"></span>
          <button type="button" class="australia-next australia-icon-button" aria-label="下一张照片" title="下一张">${icon('<path d="m10 6 6 6-6 6"/>')}</button>
        </nav>
        <div class="australia-quality" role="group" aria-label="照片画质">
          <button type="button" data-quality="standard" aria-pressed="true" title="长边 2560 像素">标准</button>
          <button type="button" data-quality="hd" aria-pressed="false" title="长边 3840 像素">高清</button>
          <button type="button" data-quality="full" aria-pressed="false" title="保留原片尺寸">全分辨率</button>
        </div>
        <a class="australia-download" download>${icon('<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>')}<span>下载 JPG</span><span class="australia-download-size"></span></a>
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
    const counter = find('.australia-viewer-counter');
    const downloadSize = find('.australia-download-size');
    const zoom = find('.australia-zoom');
    const retry = find('.australia-retry');
    const qualityButtons = [...dialog.querySelectorAll('[data-quality]')];
    const labels = { standard: '标准', hd: '高清', full: '全分辨率' };
    let index = 0;
    let quality = 'standard';
    let request = 0;
    let pending = null;
    let shownIndex = -1;
    const stopLoading = () => {
      request++;
      if (pending) {
        pending.onload = null;
        pending.onerror = null;
        pending.src = '';
        pending = null;
      }
    };
    function readPhotos(manifest) {
      const bySlug = new Map(manifest.map(photo => [photo.slug, photo]));
      const result = links.map(link => bySlug.get(link.dataset.photo));
      if (result.some(photo => !photo || ['standard', 'hd', 'full'].some(tier => !photo.variants[tier]?.download))) {
        throw new Error('Incomplete album downloads');
      }
      return result;
    }
    function loadPhotos() {
      if (photos || loading || controller.signal.aborted) return;
      retry.hidden = true;
      loading = Promise.resolve().then(async () => {
        const embedded = document.getElementById('australia-photo-data');
        if (embedded) {
          try { photos = readPhotos(JSON.parse(embedded.textContent)); }
          catch { /* Recover from old or incomplete cached page data using a fresh request. */ }
        }
        if (!photos) {
          const response = await fetch(manifestURL, { signal: controller.signal, cache: 'no-store' });
          if (!response.ok) throw new Error('Album variants unavailable');
          photos = readPhotos(await response.json());
        }
        if (!controller.signal.aborted && dialog.open) show();
      }).catch(error => {
        if (controller.signal.aborted) return;
        console.warn('Photo metadata could not be loaded.', error);
        status.textContent = '照片信息加载失败，请点击重新加载。';
        viewport.classList.remove('is-loading');
        viewport.setAttribute('aria-busy', 'false');
        retry.hidden = false;
      }).finally(() => { loading = null; });
    }
    function show() {
      stopLoading();
      if (!photos) {
        title.textContent = '2026 澳洲';
        caption.textContent = '正在准备照片预览';
        counter.textContent = `${String(index + 1).padStart(2, '0')} / ${links.length}`;
        status.textContent = '正在加载照片信息…';
        download.removeAttribute('href');
        download.setAttribute('aria-disabled', 'true');
        download.tabIndex = -1;
        qualityButtons.forEach(button => { button.disabled = true; });
        previous.disabled = index === 0;
        next.disabled = index === links.length - 1;
        zoom.disabled = true;
        viewport.classList.add('is-loading');
        viewport.setAttribute('aria-busy', 'true');
        loadPhotos();
        return;
      }
      retry.hidden = true;
      download.removeAttribute('aria-disabled');
      download.tabIndex = 0;
      qualityButtons.forEach(button => { button.disabled = false; });
      const ticket = request;
      const photo = photos[index];
      const variant = photo.variants[quality];
      const jpeg = variant.download;
      const src = new URL(variant.src, manifestURL).href;
      const size = jpeg.bytes >= 1048576
        ? `${(jpeg.bytes / 1048576).toFixed(1)} MB`
        : `${Math.round(jpeg.bytes / 1024)} KB`;
      const detail = `${labels[quality]} · ${variant.width} × ${variant.height}`;
      title.textContent = photo.name;
      caption.textContent = `${photo.date} · ${photo.rating} 星`;
      counter.textContent = `${String(index + 1).padStart(2, '0')} / ${photos.length}`;
      status.textContent = `正在加载 ${detail}`;
      download.href = new URL(jpeg.src, manifestURL).href;
      download.download = `${photo.name}-${quality}.jpg`;
      downloadSize.textContent = size;
      download.setAttribute('aria-label', `下载${labels[quality]} JPG，${size}`);
      previous.disabled = index === 0;
      next.disabled = index === photos.length - 1;
      qualityButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.quality === quality)));
      viewport.classList.remove('is-zoomed');
      zoom.setAttribute('aria-pressed', 'false');
      zoom.disabled = true;
      viewport.classList.add('is-loading');
      viewport.setAttribute('aria-busy', 'true');
      if (shownIndex !== index) viewport.replaceChildren();
      const img = new Image();
      pending = img;
      img.alt = `${photo.date} · ${photo.name}`;
      img.decoding = 'async';
      img.onload = () => {
        if (ticket !== request || !dialog.open) return;
        pending = null;
        viewport.replaceChildren(img);
        shownIndex = index;
        viewport.classList.remove('is-loading');
        viewport.setAttribute('aria-busy', 'false');
        zoom.disabled = false;
        status.textContent = detail;
      };
      img.onerror = () => {
        if (ticket !== request || !dialog.open) return;
        pending = null;
        viewport.classList.remove('is-loading');
        viewport.setAttribute('aria-busy', 'false');
        zoom.disabled = !viewport.querySelector('img');
        status.textContent = '图片加载失败，请切换画质重试，或使用下载链接。';
      };
      img.src = src;
    }
    function move(offset) {
      const target = index + offset;
      if (target < 0 || target >= links.length) return;
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
    retry.addEventListener('click', show);
    download.addEventListener('click', event => {
      if (!photos) event.preventDefault();
    });
    find('.australia-close').addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    const toggleZoom = () => {
      if (viewport.querySelector('img') && !pending) {
        viewport.classList.toggle('is-zoomed');
        zoom.setAttribute('aria-pressed', String(viewport.classList.contains('is-zoomed')));
      }
    };
    zoom.addEventListener('click', toggleZoom);
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
      shownIndex = -1;
    });
    // Bind the viewer before any network request, so an early click never opens the raw image.
    loadPhotos();
  }
  if (typeof document$ !== 'undefined') document$.subscribe(setup);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
