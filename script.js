// Anthropic-style docs interactions (same as site-level)
function slugify(text){
  return text.toString().trim().toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Auto-hide fixed footer on scroll (hide on scroll down, show on scroll up)
function setupFooterAutoHide(){
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  let lastY = window.scrollY || 0;
  const MIN_DELTA = 4;   // ignore tiny jitters
  const REVEAL_AT_TOP = 80; // always reveal near top
  const mq = window.matchMedia('(max-width: 900px)');
  const isMobile = () => mq.matches;
  const onScroll = () => {
    // Only active on mobile viewports
    if (!isMobile()){
      footer.classList.remove('footer-hidden');
      lastY = window.scrollY || 0;
      return;
    }
    const y = window.scrollY || 0;
    const dy = y - lastY;
    // reveal near top or when scrolling up
    if (y < REVEAL_AT_TOP || dy < -MIN_DELTA){
      footer.classList.remove('footer-hidden');
    } else if (dy > MIN_DELTA){
      footer.classList.add('footer-hidden');
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  // Respond to viewport changes: reveal footer when switching to desktop
  if (mq && mq.addEventListener){
    mq.addEventListener('change', () => {
      if (!isMobile()) footer.classList.remove('footer-hidden');
      lastY = window.scrollY || 0;
      onScroll();
    });
  }
  onScroll();
}
function ensureIds(headings){
  headings.forEach(h => { if (!h.id){ h.id = slugify(h.textContent || 'section'); } });
}
function buildTOC(){
  const content = document.querySelector('.docs-content .prose');
  const tocEl = document.getElementById('toc');
  if (!content || !tocEl) return;
  const h2s = Array.from(content.querySelectorAll('h2'));
  const h3s = Array.from(content.querySelectorAll('h3'));
  ensureIds([...h2s, ...h3s]);
  let html = '';
  h2s.forEach(h2 => {
    html += `<a href="#${h2.id}" data-target="${h2.id}" class="toc-l1">${h2.textContent.replace('§','').trim()}</a>`;
    const h3After = [];
    let sib = h2.nextElementSibling;
    while (sib && sib.tagName !== 'H2'){
      if (sib.tagName === 'H3') h3After.push(sib);
      sib = sib.nextElementSibling;
    }
    if (h3After.length){
      h3After.forEach(h3 => { html += `<a href="#${h3.id}" data-target="${h3.id}" class="toc-l2">${h3.textContent.replace('§','').trim()}</a>`; });
    }
  });
  tocEl.innerHTML = html;
}
function setupScrollSpy(){
  const anchorTargets = Array.from(document.querySelectorAll('.docs-content .prose h2, .docs-content .prose h3'));
  if (!anchorTargets.length) return;
  const tocLinks = Array.from(document.querySelectorAll('.toc a'));
  const leftLinks = Array.from(document.querySelectorAll('.docs-sidebar .docs-nav a'));
  function setActive(id){
    tocLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('data-target') === id || a.getAttribute('href') === `#${id}`));
    leftLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting){ setActive(entry.target.id); } });
  }, { rootMargin: '0px 0px -60% 0px', threshold: 0.01 });
  anchorTargets.forEach(el => observer.observe(el));
}
function setupAnchorLinks(){
  const targets = document.querySelectorAll('.prose h2, .prose h3');
  targets.forEach(h => {
    if (!h.querySelector('.anchor-link')){
      const a = document.createElement('a');
      a.className = 'anchor-link';
      a.href = `#${h.id}`;
      a.textContent = '§';
      a.setAttribute('aria-label','Anchor');
      h.appendChild(a);
    }
  });
}
function setupCopyButtons(){
  const blocks = document.querySelectorAll('.code-block');
  blocks.forEach(block => {
    const btn = block.querySelector('.copy-btn');
    const pre = block.querySelector('pre');
    if (!btn || !pre) return;
    btn.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(pre.innerText);
        btn.classList.add('copied');
        btn.textContent = '已复制';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '复制'; }, 1200);
      }catch(err){
        btn.textContent = '复制失败';
        setTimeout(() => { btn.textContent = '复制'; }, 1200);
      }
    });
  });
}
function setupBackToTop(){
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  const toggle = () => { if (window.scrollY > 600) btn.classList.add('show'); else btn.classList.remove('show'); };
  window.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  toggle();
}
function setupSmoothLinks(){
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const target = document.getElementById(id);
    if (target){ e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.pushState(null, '', `#${id}`); }
  });
}

// Keep CSS var --theme-header-height in sync with actual header height
function syncHeaderHeightVar(){
  const header = document.querySelector('.site-header');
  if (!header) return;
  const h = Math.round(header.getBoundingClientRect().height);
  if (h && h > 0){
    document.documentElement.style.setProperty('--theme-header-height', `${h}px`);
  }
}

function setupMobileDrawers(){
  // Mobile TOC drawer
  const tocBtn = document.getElementById('tocMiniBtn');
  const tocDrawer = document.getElementById('tocDrawer');
  const tocClose = document.getElementById('tocCloseBtn');
  if (tocBtn && tocDrawer){
    const open = () => { tocDrawer.hidden = false; tocBtn.setAttribute('aria-expanded','true'); };
    const close = () => { tocDrawer.hidden = true; tocBtn.setAttribute('aria-expanded','false'); };
    tocBtn.addEventListener('click', () => { tocDrawer.hidden ? open() : close(); });
    if (tocClose) tocClose.addEventListener('click', close);
    document.addEventListener('click', (e) => {
      if (!tocDrawer || tocDrawer.hidden) return;
      const within = e.target.closest('#tocDrawer') || e.target.closest('#tocMiniBtn');
      if (!within) close();
    });
  }

  // Mobile NAV drawer (works on single, list and home pages)
  const navDrawer = document.getElementById('navDrawer');
  const navClose = document.getElementById('navCloseBtn');
  const navBtns = Array.from(document.querySelectorAll('.mobile-nav-btn, [data-nav-toggle]'));
  if (navBtns.length && navDrawer){
    const setExpanded = (expanded) => { navBtns.forEach(b => b.setAttribute('aria-expanded', String(expanded))); };
    const openNav = () => { navDrawer.hidden = false; setExpanded(true); };
    const closeNav = () => { navDrawer.hidden = true; setExpanded(false); };
    navBtns.forEach(btn => btn.addEventListener('click', () => { navDrawer.hidden ? openNav() : closeNav(); }));
    if (navClose) navClose.addEventListener('click', closeNav);
    document.addEventListener('click', (e) => {
      if (!navDrawer || navDrawer.hidden) return;
      const within = e.target.closest('#navDrawer') || e.target.closest('.mobile-nav-btn, [data-nav-toggle]');
      if (!within) closeNav();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initial measurement
  syncHeaderHeightVar();
  // Re-measure after fonts load and on resize which may change header height
  if (document.fonts && document.fonts.ready){ document.fonts.ready.then(syncHeaderHeightVar).catch(() => {}); }
  window.addEventListener('resize', () => { syncHeaderHeightVar(); }, { passive: true });
  
  if (document.querySelector('.docs-layout')){
    buildTOC(); setupAnchorLinks(); setupScrollSpy(); setupCopyButtons(); setupBackToTop(); setupSmoothLinks();
    // Folder sidebar toggles
    document.querySelectorAll('.folder-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('aria-controls');
        const panel = document.getElementById(id);
        if (!panel) return;
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
        btn.textContent = expanded ? '▸' : '▾';
      });
    });
  }
  // Initialize mobile drawers on all pages (home, list, single)
  setupMobileDrawers();
  // Initialize footer auto-hide
  setupFooterAutoHide();

  // Home hero search box: redirect to /search/?q=...
  try{
    const homeSearch = document.querySelector('.hero .search input[type="search"]');
    if (homeSearch){
      homeSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter'){
          const q = homeSearch.value.trim();
          if (q) window.location.href = `/search/?q=${encodeURIComponent(q)}`;
        }
      });
    }
  }catch(err){ /* no-op */ }
});
