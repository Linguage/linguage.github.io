// Anthyle docs interactions (same as site-level)
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
  const content = document.querySelector('.prose');
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
  const anchorTargets = Array.from(document.querySelectorAll('.prose h2, .prose h3'));
  if (!anchorTargets.length) return;
  const tocLinks = Array.from(document.querySelectorAll('.toc a'));
  const leftLinks = Array.from(document.querySelectorAll('.docs-sidebar .docs-nav a'));
  function setActive(id){
    let activeText = '';
    tocLinks.forEach(a => {
      const isActive = a.getAttribute('data-target') === id || a.getAttribute('href') === `#${id}`;
      a.classList.toggle('is-active', isActive);
      if (isActive) activeText = a.textContent.trim();
    });
    leftLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    
    // Update mobile TOC label if available
    if (activeText && window.updateMobileTocLabel) {
      window.updateMobileTocLabel(activeText);
    }
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
  // Mobile Floating TOC Logic
  const tocContainer = document.getElementById('mobileTocContainer');
  const tocPanel = document.getElementById('mobileTocPanel');
  const tocToggleBtn = document.getElementById('mobileTocToggleBtn');
  const tocCloseBtn = document.getElementById('mobileTocCloseBtn');
  const tocChevron = document.getElementById('mobileTocChevron');
  const tocCurrentLabel = document.getElementById('mobileTocCurrentHeading');

  if (tocContainer && tocPanel && tocToggleBtn) {
    // Initial state: chevron points up (rotate -90deg) to indicate "Expand"
    if (tocChevron) tocChevron.style.transform = 'rotate(-90deg)';

    const openToc = () => {
      tocPanel.classList.remove('hidden');
      // Use RAF to allow display change to take effect before transition
      requestAnimationFrame(() => {
        tocPanel.classList.remove('scale-95', 'opacity-0');
        tocPanel.classList.add('scale-100', 'opacity-100');
      });
      tocToggleBtn.setAttribute('aria-expanded', 'true');
      if (tocChevron) tocChevron.style.transform = 'rotate(90deg)'; // Point down
    };

    const closeToc = () => {
      tocPanel.classList.remove('scale-100', 'opacity-100');
      tocPanel.classList.add('scale-95', 'opacity-0');
      tocToggleBtn.setAttribute('aria-expanded', 'false');
      if (tocChevron) tocChevron.style.transform = 'rotate(-90deg)'; // Point up
      
      // Wait for transition duration (200ms)
      setTimeout(() => {
        if (tocToggleBtn.getAttribute('aria-expanded') === 'false') {
          tocPanel.classList.add('hidden');
        }
      }, 200);
    };

    const toggleToc = () => {
      const isExpanded = tocToggleBtn.getAttribute('aria-expanded') === 'true';
      isExpanded ? closeToc() : openToc();
    };

    tocToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleToc();
    });

    if (tocCloseBtn) {
      tocCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeToc();
      });
    }

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (tocPanel.classList.contains('hidden')) return;
      if (!tocContainer.contains(e.target)) {
        closeToc();
      }
    });

    // Click on a link inside TOC closes the panel
    const links = tocPanel.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', closeToc);
    });

    // Expose label updater
    window.updateMobileTocLabel = (text) => {
      if (tocCurrentLabel) tocCurrentLabel.textContent = text || "目录";
    };
  }

  // Mobile NAV drawer (works on single, list and home pages)
  const navDrawer = document.getElementById('navDrawer');
  const navOverlay = document.getElementById('navOverlay');
  const navClose = document.getElementById('navCloseBtn');
  // Match both the main header toggle and any other potential triggers
  const navBtns = Array.from(document.querySelectorAll('.nav-toggle-btn, .mobile-nav-btn, [data-nav-toggle]'));
  
  console.log('[Drawer] Setup:', { 
    drawer: !!navDrawer, 
    overlay: !!navOverlay, 
    btns: navBtns.length 
  });

  if (navBtns.length && navDrawer){
    const setExpanded = (expanded) => { navBtns.forEach(b => b.setAttribute('aria-expanded', String(expanded))); };
    
    const openNav = () => {
      console.log('[Drawer] Opening');
      // Show overlay
      if (navOverlay) {
        navOverlay.classList.remove('pointer-events-none', 'opacity-0');
        navOverlay.classList.add('pointer-events-auto', 'opacity-100');
      }
      // Slide in drawer
      navDrawer.classList.remove('-translate-x-full');
      setExpanded(true);
      document.body.style.overflow = 'hidden'; // Lock body scroll
    };
    
    const closeNav = () => {
      console.log('[Drawer] Closing');
      // Hide overlay
      if (navOverlay) {
        navOverlay.classList.remove('pointer-events-auto', 'opacity-100');
        navOverlay.classList.add('pointer-events-none', 'opacity-0');
      }
      // Slide out drawer
      navDrawer.classList.add('-translate-x-full');
      setExpanded(false);
      document.body.style.overflow = ''; // Unlock body scroll
    };

    // Toggle based on current state (check class)
    const toggleNav = (e) => {
      if(e) e.preventDefault(); // Prevent default button behavior
      const isOpen = !navDrawer.classList.contains('-translate-x-full');
      console.log('[Drawer] Toggle clicked. Currently open:', isOpen);
      isOpen ? closeNav() : openNav();
    };

    navBtns.forEach(btn => btn.addEventListener('click', toggleNav));
    if (navClose) navClose.addEventListener('click', closeNav);
    
    // Click outside (on overlay)
    if (navOverlay) {
      navOverlay.addEventListener('click', closeNav);
    }

    // Close on Escape key
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape' && !navDrawer.classList.contains('-translate-x-full')) {
        closeNav();
      }
    });
  }
}

function setupMobileSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  const searchContainer = document.getElementById('siteSearchContainer');
  const searchBackBtn = document.getElementById('searchBackBtn');
  const header = document.querySelector('header.site-header');

  if (searchInput && searchContainer) {
    const expandSearch = () => {
      // Only expand on mobile/tablet (check if container isn't already taking up space naturally)
      if (window.innerWidth < 1024) { 
        searchContainer.classList.add('fixed', 'inset-0', 'z-[60]', 'glass-popover', 'px-4', 'h-16', 'border-b', 'border-border');
        searchContainer.classList.remove('relative', 'w-full', 'max-w-md');
        if (header) header.classList.add('z-[60]'); // Ensure header stack is high
        if (searchBackBtn) searchBackBtn.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Lock scroll
      }
    };

    const collapseSearch = () => {
      searchContainer.classList.remove('fixed', 'inset-0', 'z-[60]', 'glass-popover', 'px-4', 'h-16', 'border-b', 'border-border');
      searchContainer.classList.add('relative', 'w-full', 'max-w-md');
      if (header) header.classList.remove('z-[60]');
      if (searchBackBtn) searchBackBtn.classList.add('hidden');
      document.body.style.overflow = '';
    };

    searchInput.addEventListener('focus', expandSearch);
    
    if (searchBackBtn) {
      searchBackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        collapseSearch();
        searchInput.value = ''; // Optional: clear on cancel
      });
    }
  }
}

const THEME_KEY = 'theme';
const themeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let themeToggleBtn = null;
const THEME_ICON_LIGHT = '◐';
const THEME_ICON_DARK = '◑';

function getSavedTheme(){
  try{
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark'){ return saved; }
  }catch(err){ /* ignore storage errors */ }
  return null;
}

function syncGiscusTheme(theme){
  const iframe = document.querySelector('iframe.giscus-frame');
  if (!iframe) return;
  try{
    iframe.contentWindow?.postMessage({
      giscus: { setConfig: { theme } }
    }, 'https://giscus.app');
  }catch(err){ /* ignore cross-origin issues */ }
}

function updateThemeToggleIcon(){
  if (!themeToggleBtn) return;
  // Icon handled by CSS ::after based on data-theme to prevent FOUC
  // themeToggleBtn.textContent = effectiveDark ? THEME_ICON_DARK : THEME_ICON_LIGHT;
  themeToggleBtn.setAttribute('aria-label','切换主题');
  themeToggleBtn.setAttribute('title','切换主题');
}

function applyThemePreference(theme){
  const root = document.documentElement;
  const prefersDark = themeMediaQuery ? themeMediaQuery.matches : false;
  const manual = (theme === 'light' || theme === 'dark');
  const effective = manual ? theme : (prefersDark ? 'dark' : 'light');

  if (effective === 'dark'){
    root.dataset.theme = 'dark';
  } else if (manual){
    root.dataset.theme = 'light';
  } else {
    delete root.dataset.theme;
  }

  if (manual){
    root.dataset.themeManual = 'true';
  } else {
    delete root.dataset.themeManual;
  }

  updateThemeToggleIcon();
  // Map site theme to giscus theme names
  const giscusTheme = effective === 'dark' ? 'dark' : 'light';
  syncGiscusTheme(giscusTheme);
}

function setThemePreference(theme){
  try{
    if (theme === 'light' || theme === 'dark'){
      localStorage.setItem(THEME_KEY, theme);
    } else {
      localStorage.removeItem(THEME_KEY);
    }
  }catch(err){ /* ignore storage errors */ }
  applyThemePreference(theme);
}

function toggleThemePreference(){
  const root = document.documentElement;
  const manual = root.dataset.themeManual === 'true';
  const manualTheme = manual ? (root.dataset.theme || null) : null;
  const prefersDark = themeMediaQuery ? themeMediaQuery.matches : false;
  let next;
  if (!manual){
    next = prefersDark ? 'light' : 'dark';
  } else if (manualTheme === 'dark'){
    next = 'light';
  } else {
    // 当前是手动浅色。优先切到深色，若系统偏好深色则回到系统模式即可达成同样效果。
    next = prefersDark ? null : 'dark';
  }
  setThemePreference(next);
}

function initThemeToggle(){
  themeToggleBtn = document.getElementById('themeToggle');
  if (!themeToggleBtn) return;
  const saved = getSavedTheme();
  applyThemePreference(saved);
  themeToggleBtn.addEventListener('click', toggleThemePreference);
  if (themeMediaQuery){
    const mqListener = () => {
      if (!document.documentElement.dataset.theme){
        applyThemePreference(null);
      } else {
        updateThemeToggleIcon();
      }
    };
    if (themeMediaQuery.addEventListener){
      themeMediaQuery.addEventListener('change', mqListener);
    } else if (themeMediaQuery.addListener){
      themeMediaQuery.addListener(mqListener);
    }
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
  // setupMobileSearch(); // Disabled to avoid conflict with search-advanced.js
  // Initialize footer auto-hide
  setupFooterAutoHide();
  // Theme toggle button (light/dark)
  initThemeToggle();

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
