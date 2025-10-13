(function () {
  const API = 'https://api.microlink.io/?audio=false&video=false&screenshot=false&palette=false&meta=true&url=';

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

    a.innerHTML = `
      <div class="link-card__media">
        ${image && image.url ? `<img src="${image.url}" alt="">` : (logo && logo.url ? `<img src="${logo.url}" alt="">` : '')}
      </div>
      <div class="link-card__body">
        <div class="link-card__site">${publisher || host}</div>
        <div class="link-card__title">${title || ''}</div>
        <div class="link-card__desc">${description || ''}</div>
      </div>
    `;
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
