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

  function createCard({ url, data }) {
    const { title, description, publisher, image, logo, url: finalUrl } = data || {};
    const a = document.createElement('a');
    a.className = 'link-card__inner';
    a.href = finalUrl || url;
    a.target = '_blank';
    a.rel = 'noopener';

    const host = (() => {
      try { return new URL(finalUrl || url).hostname; } catch { return url; }
    })();

    const media = document.createElement('div');
    media.className = 'link-card__media';
    const img = document.createElement('img');
    img.alt = '';
    // 固定尺寸，避免 CLS；与 CSS 方形缩略图匹配
    img.width = 84; img.height = 84;

    const primary = (image && image.url) ? image.url : (logo && logo.url ? logo.url : '');
    const fallFavicon = faviconFromHost(host);
    img.src = primary || fallFavicon || placeholderSVG(host[0]);
    img.onerror = function () {
      // 第一次失败，尝试 favicon；若已是 favicon 再失败，换占位 SVG
      if (this.dataset.state !== 'favicon') {
        this.dataset.state = 'favicon';
        this.src = fallFavicon || placeholderSVG(host[0]);
      } else {
        this.src = placeholderSVG(host[0]);
      }
    };
    media.appendChild(img);

    const body = document.createElement('div');
    body.className = 'link-card__body';
    body.innerHTML = `
      <div class="link-card__site">${publisher || host}</div>
      <div class="link-card__title">${title || ''}</div>
      <div class="link-card__desc">${description || ''}</div>
    `;

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
        el.innerHTML = '';
        el.appendChild(createCard({ url, data: json.data }));
        el.classList.add('link-card--ready');
      }
    } catch (e) {
      // 失败时保留 fallback 超链接
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
