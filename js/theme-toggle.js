(function(){
  const KEY = 'theme'; // 'light' | 'dark' | null (follow system)
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');

  if (!btn) return; // nothing to do if button is absent

  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  function apply(theme){
    if (!theme){
      delete root.dataset.theme; // follow system
    } else {
      root.dataset.theme = theme; // force
    }
    renderIcon();
  }

  function current(){
    return root.dataset.theme || null; // null means follow system
  }

  function renderIcon(){
    const manual = current();
    const isDark = manual ? manual === 'dark' : mq.matches;
    // Dark -> show sun; Light -> show moon
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', '切换主题');
    btn.setAttribute('title', '切换主题');
  }

  function toggle(){
    const manual = current();
    // cycle: null/auto -> dark -> light -> dark ... keep just two states for clarity
    let next;
    if (!manual){
      // from auto, go to opposite of system
      next = mq.matches ? 'light' : 'dark';
    } else {
      // toggle between light and dark
      next = manual === 'dark' ? 'light' : 'dark';
    }
    localStorage.setItem(KEY, next);
    apply(next);
    syncGiscus(next);
  }

  function syncGiscus(theme){
    const iframe = document.querySelector('iframe.giscus-frame');
    if (!iframe) return;
    try{
      iframe.contentWindow?.postMessage({
        giscus: {
          setConfig: { theme: theme === 'dark' ? 'dark' : 'light' }
        }
      }, 'https://giscus.app');
    }catch(err){ /* ignore */ }
  }

  // Initialize from saved
  const saved = localStorage.getItem(KEY);
  apply(saved === 'light' || saved === 'dark' ? saved : null);

  // React to system changes only when following system (no manual override)
  mq.addEventListener?.('change', function(){
    if (!current()){
      renderIcon();
    }
  });

  btn.addEventListener('click', toggle);
})();
