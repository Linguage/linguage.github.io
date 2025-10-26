(function () {
  const API = 'https://api.microlink.io/?audio=false&video=false&screenshot=false&palette=false&meta=true&url=';

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

  function renderCard(el, url, data) {
    el.innerHTML = '';
    el.appendChild(createCard({ url, data }));
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

  function createCard({ url, data }) {
    const { title, description, publisher, image, logo } = data || {};
    const a = document.createElement('a');
    const host = (() => {
      try { return new URL(url).hostname; } catch { return url; }
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
      'sm:flex-row',
      'sm:items-center'
    ].join(' ');
    // Always prefer the original input URL to avoid being hijacked by stale canonical/og:url
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';

    const media = document.createElement('div');
    media.className = [
      'link-card__media',
      'grid',
      'place-items-center',
      'relative',
      'h-[84px]',
      'w-[84px]',
      'flex-shrink-0',
      'overflow-hidden',
      'rounded-xl',
      'bg-[var(--lc-media-bg,rgba(15,23,42,0.06))]',
      'sm:h-[84px]',
      'sm:w-[84px]'
    ].join(' ');
    const img = document.createElement('img');
    img.alt = '';
    // 固定尺寸，避免 CLS；与 CSS 方形缩略图匹配
    img.width = 84; img.height = 84;
    img.className = 'block h-full w-full object-cover object-center transition-transform duration-200 group-hover/link-card:scale-[1.02]';

    const primary = (image && image.url) ? image.url : (logo && logo.url ? logo.url : '');
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
    siteEl.className = 'link-card__site text-xs uppercase tracking-wide text-[var(--lc-site,rgba(107,114,128,0.78))]';
    siteEl.textContent = publisher || host;

    const titleEl = document.createElement('div');
    titleEl.className = 'link-card__title text-base font-semibold text-[var(--lc-title,#111827)] line-clamp-2 transition-colors duration-150 group-hover/link-card:text-[var(--lc-title-hover,#0f172a)]';
    titleEl.textContent = title || host;

    const descEl = document.createElement('div');
    descEl.className = 'link-card__desc text-sm text-[var(--lc-desc,rgba(55,65,81,0.88))] line-clamp-2';
    descEl.textContent = description || url;

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
      const res = await fetch(API + encodeURIComponent(url));
      const json = await res.json();
      if (json && json.status === 'success' && json.data) {
        renderCard(el, url, json.data);
      } else {
        renderPlaceholder(el, url);
      }
    } catch (e) {
      renderPlaceholder(el, url);
    }
  }

  function init() {
    document.querySelectorAll('.link-card').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
