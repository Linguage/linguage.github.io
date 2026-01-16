(function () {
  const API = 'https://api.microlink.io/?audio=false&video=false&screenshot=false&palette=false&meta=true&url=';
  const MAX_PARALLEL = 4;
  const MAX_RETRIES = 3;
  const RETRY_BASE_DELAY = 600;

  function faviconFromHost(host) {
    if (!host) return '';
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  }

  function placeholderSVG(hostInitial) {
    const ch = (hostInitial || '·').slice(0, 1).toUpperCase();
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84' viewBox='0 0 84 84' role='img' aria-label=''>` +
      `<rect width='84' height='84' rx='10' fill='#e5e7eb'/>` +
      `<text x='50%' y='54%' text-anchor='middle' dominant-baseline='middle' font-family='system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' font-size='36' fill='#6b7280'>${ch}</text>` +
      `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function applySizing(el) {
    try {
      const ds = el.dataset || {};
      const media = el.querySelector('.link-card__media') || el.querySelector('div[class*="rounded-xl"]');
      if (!media) return;
      const raw = ds.size || '84';
      const size = Math.max(24, Math.min(parseInt(String(raw).replace('px', ''), 10) || 84, 320));
      const ratioStr = ds.ratio || '1:1';
      const m = String(ratioStr).match(/^(\d+)\s*[:/]\s*(\d+)$/);
      let w = 1, h = 1;
      if (m) { w = parseInt(m[1], 10) || 1; h = parseInt(m[2], 10) || 1; }
      media.style.width = `${size}px`;
      if (w === h) {
        media.style.height = `${size}px`;
        media.style.removeProperty('aspect-ratio');
      } else if ('aspectRatio' in media.style) {
        media.style.removeProperty('height');
        media.style.aspectRatio = `${w} / ${h}`;
      } else {
        media.style.height = `${Math.round(size * (h / w))}px`;
      }
      const img = media.querySelector('img');
      if (img) {
        img.width = size;
        img.height = (w === h) ? size : Math.round(size * (h / w));
      }
    } catch (_) {}
  }

  function renderCard(el, url, data) {
    el.innerHTML = '';
    el.appendChild(createCard({ url, data, ds: el.dataset }));
    el.classList.add('link-card--ready');
  }

  function renderPlaceholder(el, url) {
    const host = (() => {
      try { return new URL(url).hostname; } catch { return url; }
    })();
    renderCard(el, url, {
      title: host,
      description: url,
      publisher: host
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchMetadataWithRetry(url) {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(API + encodeURIComponent(url));
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
        } else {
          const json = await res.json();
          if (json && json.status === 'success' && json.data) {
            return json.data;
          }
          lastError = new Error((json && (json.error?.code || json.status)) || 'microlink_error');
        }
      } catch (error) {
        lastError = error;
      }

      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BASE_DELAY * (attempt + 1));
      }
    }

    throw lastError;
  }

  function createCard({ url, data, ds }) {
    const { title, description, publisher, image, logo } = data || {};
    const a = document.createElement('a');
    const host = (() => {
      try { return new URL(url).hostname; } catch { return url; }
    })();

    // Options from data-* overrides
    const layout = (ds && (ds.layout || ds.Layout)) || 'h';
    const mediaPos = (() => {
      const mp = ds && (ds.mediaPos || ds.media_pos);
      if (mp) return String(mp).toLowerCase();
      // derive from layout when not provided
      return layout === 'v' ? 'top' : 'left';
    })();
    const size = (() => {
      const raw = (ds && ds.size) || 84;
      const n = parseInt(String(raw).replace('px', ''), 10);
      return isNaN(n) ? 84 : Math.max(24, Math.min(n, 320));
    })();
    const ratioStr = (ds && ds.ratio) || '1:1';
    const ratio = (() => {
      const m = String(ratioStr).match(/^(\d+)\s*[:/]\s*(\d+)$/);
      if (!m) return { w: 1, h: 1 };
      const w = parseInt(m[1], 10) || 1;
      const h = parseInt(m[2], 10) || 1;
      return { w, h };
    })();

    const flowClasses = (() => {
      switch (mediaPos) {
        case 'right': return ['sm:flex-row-reverse', 'sm:items-center'];
        case 'bottom': return ['sm:flex-col-reverse'];
        case 'top': return ['sm:flex-col'];
        case 'left':
        default: return ['sm:flex-row', 'sm:items-center'];
      }
    })();

    a.className = [
      'link-card__inner',
      'group/link-card',
      'flex',
      'flex-col',
      'gap-4',
      'px-4',
      'py-3',
      'transition-colors',
      'duration-150',
      'no-underline',
      ...flowClasses
    ].join(' ');
    // Always prefer the original input URL to avoid being hijacked by stale canonical/og:url
    a.href = url;
    a.target = (ds && ds.target) || '_blank';
    a.rel = 'noopener';

    const media = document.createElement('div');
    media.className = [
      'link-card__media',
      'grid',
      'place-items-center',
      'relative',
      'flex-shrink-0',
      'overflow-hidden',
      'rounded-xl',
      'bg-black/5',
      'dark:bg-white/5'
    ].join(' ');
    // Set size/ratio via inline styles to avoid depending on Tailwind class generation
    media.style.width = `${size}px`;
    if (ratio.w === ratio.h) {
      media.style.height = `${size}px`;
    } else if ('aspectRatio' in media.style) {
      media.style.removeProperty('height');
      media.style.aspectRatio = `${ratio.w} / ${ratio.h}`;
    } else {
      // Fallback: compute height from ratio
      media.style.height = `${Math.round(size * (ratio.h / ratio.w))}px`;
    }
    const img = document.createElement('img');
    img.alt = '';
    // Provide width/height to mitigate CLS (best-effort)
    img.width = size; img.height = (ratio.w === ratio.h) ? size : Math.round(size * (ratio.h / ratio.w));
    img.className = 'block h-full w-full object-cover object-center transition-transform duration-200 group-hover/link-card:scale-[1.02]';

    // Manual overrides from dataset
    const manualImage = ds && ds.image;
    const manualTitle = ds && ds.title;
    const manualDesc = ds && ds.desc;
    const manualSite = ds && ds.site;

    const primary = manualImage || ((image && image.url) ? image.url : (logo && logo.url ? logo.url : ''));
    const fallFavicon = faviconFromHost(host);

    if (primary) {
      img.addEventListener('load', () => {
        media.style.background = 'transparent';
      });
    }

    const applyFallbackBackground = () => {
      media.style.removeProperty('background');
    };

    img.src = primary || fallFavicon || placeholderSVG(host[0]);
    img.onerror = function () {
      // 第一次失败，尝试 favicon；若已是 favicon 再失败，换占位 SVG
      if (this.dataset.state !== 'favicon') {
        this.dataset.state = 'favicon';
        applyFallbackBackground();
        this.src = fallFavicon || placeholderSVG(host[0]);
      } else {
        applyFallbackBackground();
        this.src = placeholderSVG(host[0]);
      }
    };
    media.appendChild(img);

    const body = document.createElement('div');
    body.className = 'link-card__body min-w-0 flex flex-col gap-2';

    const siteEl = document.createElement('div');
    siteEl.className = 'text-xs uppercase tracking-wide text-muted';
    siteEl.textContent = manualSite || publisher || host;

    const titleEl = document.createElement('div');
    titleEl.className = 'link-card__title text-base font-semibold text-text line-clamp-2 transition-colors duration-150 group-hover/link-card:text-accent';
    titleEl.textContent = manualTitle || title || host;

    const descEl = document.createElement('div');
    descEl.className = 'link-card__desc text-sm text-muted opacity-90 line-clamp-2';
    descEl.textContent = manualDesc || description || url;

    body.appendChild(siteEl);
    body.appendChild(titleEl);
    body.appendChild(descEl);

    a.appendChild(media);
    a.appendChild(body);
    return a;
  }

  async function enhance(el) {
    const url = el.getAttribute('data-url');
    if (!url) return;

    try {
      const data = await fetchMetadataWithRetry(url);
      renderCard(el, url, data);
    } catch (e) {
      renderPlaceholder(el, url);
    }
  }

  function init() {
    const elements = Array.from(document.querySelectorAll('.link-card'));
    if (!elements.length) return;

    let cursor = 0;
    let active = 0;

    const next = () => {
      if (cursor >= elements.length) return;
      while (active < MAX_PARALLEL && cursor < elements.length) {
        const el = elements[cursor++];
        // Always apply sizing from dataset (works for fetch and manual modes)
        applySizing(el);
        active++;
        enhance(el)
          .catch(() => {})
          .finally(() => {
            active--;
            next();
          });
      }
    };

    next();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
