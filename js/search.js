// Simple site-wide search with popover results
// Data source: /index.json produced by Hugo SearchIndex output
(function(){
  const INPUT_ID = 'globalSearchInput';
  const POPOVER_ID = 'globalSearchPopover';
  const MAX_RESULTS = 10;
  const TOGGLE_ID = 'searchToggleBtn';
  const BACK_ID = 'searchBackBtn';
  // 统一索引地址：优先使用模板注入的全局变量；否则基于当前页构造绝对 URL
  const FETCH_URL = (window.SEARCH_INDEX_URL || new URL('index.json', document.baseURI).toString());

  // modes: all | posts | page
  let mode = 'all';
  let data = null;        // site index
  let pageData = null;    // current page index
  let box = null;
  let pop = null;
  let activeIndex = -1;
  let isComposing = false;
  let lastOpenAt = 0; // 防止不同浏览器事件顺序导致“刚打开就被关闭”
  // 渐进加载状态
  let visibleCount = 0;           // 当前已展示数量（全站/Posts）
  let lastResults = [];           // 最近一次去重排序后的完整结果
  let lastTotal = 0;              // 最近一次结果总数
  let lastQuery = '';             // 最近一次查询串
  // Debug 开关：在本地开发端口 1313 或手动设置 window.DEBUG_SEARCH=true 时输出调试日志
  const DEBUG = (typeof window !== 'undefined' && (
    (window.location && window.location.port === '1313') || (window.DEBUG_SEARCH === true)
  ));
  function dbg(){ if (DEBUG) { try { console.debug('[search]', ...arguments); } catch(_){} } }
  let toggleBtn = null;
  let backBtn = null;
  // 索引加载状态
  // idle -> loading -> ready | error
  let indexStatus = 'idle';
  const INDEX_CACHE_KEY = 'site_search_index::'+FETCH_URL;

  function $(id){ return document.getElementById(id); }

  function debounce(fn, delay){ let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }

  function loadIndexFromCache(){
    try{
      const raw = localStorage.getItem(INDEX_CACHE_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.items)) return false;
      data = obj.items;
      indexStatus = 'ready';
      dbg('index cache hit', { size: data.length });
      return true;
    }catch(_){ return false; }
  }

  async function fetchIndexWithTimeout(signal){
    const ctrl = new AbortController();
    const timer = setTimeout(()=> ctrl.abort(), 5000); // 5s 超时
    let res;
    try{
      res = await fetch(FETCH_URL, { credentials: 'same-origin', signal: (signal||ctrl.signal) });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error('HTTP '+res.status);
    const json = await res.json();
    return json;
  }

  async function prefetchIndex(){
    if (indexStatus === 'loading' || indexStatus === 'ready') return;
    indexStatus = 'loading';
    dbg('index prefetch start');
    try{
      const json = await fetchIndexWithTimeout();
      data = Array.isArray(json) ? json : (json && json.items) || json;
      if (!Array.isArray(data)) data = [];
      indexStatus = 'ready';
      try{ localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify({ items: data, ts: Date.now() })); }catch(_){/* no-op */}
      dbg('index prefetch done', { size: data.length });
    }catch(err){
      indexStatus = 'error';
      console.error('[search] failed to load index:', FETCH_URL, err);
    }
  }

  async function ensureData(){
    if (data) return data;
    if (indexStatus === 'idle'){ loadIndexFromCache(); }
    if (data) return data;
    await prefetchIndex();
    return data || [];
  }

  function buildPageIndex(){
    if (pageData) return pageData;
    const container = document.querySelector('.docs-content .prose') || document.querySelector('main') || document.body;
    const items = [];
    // 选取常见块级元素作为索引单元，便于精确跳转
    const blocks = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,td')); 
    let lastHeadingText = document.title;
    blocks.forEach((el, idx) => {
      const tag = el.tagName.toLowerCase();
      if (/h[1-6]/.test(tag)) {
        lastHeadingText = (el.textContent || lastHeadingText).trim() || lastHeadingText;
      }
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (!text) return;
      if (!el.id) el.id = `s-${idx+1}`; // 动态生成锚点
      items.push({
        title: lastHeadingText,
        url: (location.pathname + '#' + el.id),
        section: 'page',
        date: '',
        summary: text.slice(0, 200),
        description: '',
        tags: [],
        categories: [],
        content: text
      });
    });
    if (!items.length){
      const text = (container.textContent || '').replace(/\s+/g,' ').trim();
      items.push({ title: document.title, url: location.pathname, section: 'page', date: '', summary: text.slice(0,200), description:'', tags:[], categories:[], content: text });
    }
    pageData = items;
    return pageData;
  }

  function tokenize(q){
    return (q || '').toString().toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  // 规范化 URL 路径用于“文章级”去重与计数（忽略查询与 hash）
  function normalizeUrlPath(u){
    try{
      const url = new URL(u, document.baseURI);
      return url.pathname;
    }catch(_){
      return (u||'').split('#')[0].split('?')[0];
    }
  }

  function escapeRegExp(str){
    return str.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }

  // 构造允许穿插字符的模糊匹配正则，例如 "abc" -> /a.*b.*c/i
  function fuzzyRegexFromQuery(q){
    const chars = q.split('').map(ch => escapeRegExp(ch));
    return new RegExp(chars.join('.*'), 'i');
  }

  function fuzzyMatchScore(text, q){
    if (!q) return 0;
    try{
      const re = fuzzyRegexFromQuery(q);
      if (re.test(text)){
        // 简单给定一个正分作为加权；可按匹配跨度进一步评分
        return Math.min(15, 5 + Math.floor(Math.max(2, q.length)/1.5));
      }
    }catch(_){/* no-op */}
    return 0;
  }

  function scoreDoc(doc, qWords, qLower){
    const title = (doc.title||'').toLowerCase();
    const summary = (doc.summary||'').toLowerCase();
    const content = (doc.content||'').toLowerCase();
    const tags = (doc.tags||[]).join(' ').toLowerCase();

    // page 模式：只按 content 计分，避免标题或其它字段导致“未高亮内容”入选
    if (mode === 'page'){
      let s = 0;
      qWords.forEach(w => { if (content.includes(w)) s += 6; });
      if (content.includes(qLower)) s += 20; // 整句命中加权
      s += fuzzyMatchScore(content, qLower);
      return s;
    }

    // 其它模式：保留原有多字段计分
    let score = 0;
    qWords.forEach(w => {
      if (title.includes(w)) score += 12;
      if (summary.includes(w)) score += 6;
      if (content.includes(w)) score += 2;
      if (tags.includes(w)) score += 4;
    });
    if (title.includes(qLower)) score += 20;
    if (summary.includes(qLower)) score += 10;
    if (content.includes(qLower)) score += 3;
    return score;
  }

  function highlight(text, qWords){
    if (!text) return '';
    let t = text;
    try{
      qWords.forEach(w => {
        if (!w) return;
        const re = new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
        t = t.replace(re, '<mark>$1</mark>');
      });
    }catch(_){/* no-op */}
    return t;
  }

  function buildSnippet(doc, qWords){
    const base = doc.summary || doc.description || doc.content || '';
    const text = base.replace(/\s+/g,' ').trim();
    if (!text) return '';
    const lower = text.toLowerCase();
    let pos = -1;
    for (const w of qWords){
      pos = lower.indexOf(w);
      if (pos >= 0) break;
    }
    if (pos < 0) pos = 0;
    const start = Math.max(0, pos - 40);
    const end = Math.min(text.length, start + 160);
    let slice = text.slice(start, end) + (end < text.length ? '…' : '');
    // 若未匹配到连续词而处于本页模式，则用模糊序列高亮
    if (mode === 'page' && qWords.length === 1 && lower.indexOf(qWords[0]) < 0){
      const q = qWords[0];
      // 简单顺序高亮：按字符依序包裹 <mark>
      let remaining = q.toLowerCase().split('');
      let out = '';
      for (let i=0; i<slice.length; i++){
        const ch = slice[i];
        if (remaining.length && ch.toLowerCase() === remaining[0]){
          out += '<mark>'+ch+'</mark>';
          remaining.shift();
        } else {
          out += ch;
        }
      }
      return out;
    }
    return highlight(slice, qWords);
  }

  // 全局：为“本页搜索”提取所在行（按句/换行边界），避免作用域问题
  function buildLineSnippet(doc, qWords, qLower){
    const text = (doc.content || '').replace(/\s+/g,' ').trim();
    if (!text) return '';
    const idx = text.toLowerCase().indexOf(qLower);
    if (idx >= 0){
      let start = 0, end = text.length;
      for (let i = idx; i >= 0; i--){ if ("。！？!?\.".includes(text[i])){ start = i+1; break; } }
      for (let i = idx; i < text.length; i++){ if ("。！？!?\.".includes(text[i])){ end = i+1; break; } }
      let line = text.slice(start, end).trim();
      if (line.length > 160){
        // 居中裁剪：尽量包含命中位置
        const center = idx - start;
        const half = 80;
        const s = Math.max(0, center - half);
        const e = Math.min(line.length, center + half);
        line = (s>0?'…':'') + line.slice(s, e) + (e<line.length?'…':'');
      }
      return highlight(line, [qLower]);
    }
    try{
      const re = fuzzyRegexFromQuery(qLower);
      const m = text.match(re);
      if (m && m.index != null){
        const pos = m.index;
        let start = 0, end = text.length;
        for (let i = pos; i >= 0; i--){ if ("。！？!?\.".includes(text[i])){ start = i+1; break; } }
        for (let i = pos; i < text.length; i++){ if ("。！？!?\.".includes(text[i])){ end = i+1; break; } }
        let line = text.slice(start, end).trim();
        if (line.length > 160){
          const center = pos - start;
          const half = 80;
          const s = Math.max(0, center - half);
          const e = Math.min(line.length, center + half);
          line = (s>0?'…':'') + line.slice(s, e) + (e<line.length?'…':'');
        }
        let remaining = qLower.split('');
        let out = '';
        for (let i=0; i<line.length; i++){
          const ch = line[i];
          if (remaining.length && ch.toLowerCase() === remaining[0]){ out += '<mark>'+ch+'</mark>'; remaining.shift(); }
          else { out += ch; }
        }
        return out;
      }
    }catch(_){/* no-op */}
    // 未命中则返回空，避免出现没有高亮的条目
    return '';
  }
  function render(items, q, total){
    if (!pop) return;
    const placeholder = mode === 'all' ? '全站搜索…' : (mode === 'posts' ? 'Posts 内部搜索…' : '当前页面搜索…');
    if (box) box.setAttribute('placeholder', placeholder);

    const tabsHtml = '<div class="search-mode-head">'
      + '<div class="search-mode-label">搜索选项</div>'
      + '<div class="search-mode-tabs" role="tablist">'
      + `<button class="mode-tab ${mode==='all'?'is-active':''}" data-mode="all">全站</button>`
      + `<button class="mode-tab ${mode==='posts'?'is-active':''}" data-mode="posts">Posts</button>`
      + `<button class="mode-tab ${mode==='page'?'is-active':''}" data-mode="page">本页</button>`
      + '</div>'
      + '</div>';

    // 未就绪时在 tabs 下方提示用户“可先使用本页搜索”
    const loadingBar = (indexStatus === 'loading') ? '<div class="search-popover-info">正在准备全站索引…可先使用【本页】搜索</div>'
                     : (indexStatus === 'error') ? '<div class="search-popover-info">索引加载失败，稍后重试；【本页】仍可用</div>'
                     : '';

    pop.innerHTML = tabsHtml + loadingBar;
    pop.hidden = false;
    // 保留 openMobile() 设定的未来时间，避免刚打开就被 onDocClick 误关闭
    lastOpenAt = Math.max(lastOpenAt, Date.now());
    dbg('render header', { mode, q, total, lastOpenAt });
    bindQuickEvents();

    if (!q) return;

    const qWords = tokenize(q);
    const qLower = q.toLowerCase();
    const modeLabel = mode==='all'?'全站':(mode==='posts'?'Posts':'本页');
    const pageSize = MAX_RESULTS;
    // 仅在全站/Posts模式做渐进加载
    const sliceNeeded = (mode !== 'page');
    if (sliceNeeded){ if (!visibleCount) visibleCount = pageSize; }
    const vis = sliceNeeded ? items.slice(0, Math.min(items.length, visibleCount)) : items;
    const header = `<div class="search-popover-header">【${modeLabel}】显示前 ${vis.length} 条 / 共 ${total} ${mode==='page'?'条命中':'篇结果'} · 按 ↑/↓ 选择，Enter 打开，Esc 关闭</div>`;
    let list = '';
    if (mode === 'page'){
      const parts = [];
      vis.forEach((it, i)=>{
        const line = buildLineSnippet(it, qWords, qLower);
        if (!line || line.indexOf('<mark>') === -1) return; // 仅保留真正命中的行
        const cls = 'search-item'+(i===activeIndex?' is-active':'');
        parts.push(`<a class="${cls}" data-index="${i}" href="${it.url}">\
          <div class="search-item-line">${line}</div>\
        </a>`);
      });
      list = parts.join('');
    } else {
      list = vis.map((it, i)=>{
        const cls = 'search-item'+(i===activeIndex?' is-active':'');
        const snippet = buildSnippet(it, qWords);
        const meta = [it.section, it.date].filter(Boolean).join(' · ');
        return `<a class="${cls}" data-index="${i}" href="${it.url}">\
          <div class="search-item-title">${highlight(it.title, qWords)}</div>\
          <div class="search-item-meta">${meta}</div>\
          ${snippet?`<div class="search-item-snippet">${snippet}</div>`:''}\
        </a>`;
      }).join('');
    }
    pop.insertAdjacentHTML('beforeend', header + `<div class="search-results">${list||'<div style=\"padding:12px;\">未找到结果</div>'}</div>`);

    // 渐进加载按钮
    if (sliceNeeded && total > vis.length){
      const moreHtml = `<div class="search-more"><button id="searchLoadMoreBtn" class="search-more-btn">显示更多</button></div>`;
      pop.insertAdjacentHTML('beforeend', moreHtml);
      const moreBtn = pop.querySelector('#searchLoadMoreBtn');
      if (moreBtn){
        moreBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          visibleCount += pageSize;
          // 重新渲染使用完整缓存
          render(lastResults, lastQuery, lastTotal);
          // 重置活动项到首项
          activeIndex = 0;
        });
      }
    }
  }

  // 顶层：移动端展开/收起（供 setup 与其它逻辑调用）
  function openMobile(){
    dbg('openMobile:start', { mm: window.matchMedia && window.matchMedia('(max-width: 900px)').matches, bodyMobile: document.body.classList.contains('mobile-searching') });
    if (!window.matchMedia('(max-width: 900px)').matches) {
      dbg('openMobile:ignored due to width');
      return;
    }
    if (!document.body.classList.contains('mobile-searching')){
      document.body.classList.add('mobile-searching');
    }
    lastOpenAt = Date.now() + 450; // 增大保护时间
    if (pop) { try{ pop.hidden = false; }catch(_){/* no-op */} }
    try{
      if (box){
        box.focus();
        const q = box.value.trim();
        if (q){ onInput(); }
        else { render([], '', 0); }
      }
    }catch(_){/* no-op */}
    dbg('openMobile:end', { lastOpenAt });
  }
  function closeMobile(){
    dbg('closeMobile');
    document.body.classList.remove('mobile-searching');
    closePopover();
    try{ box && box.blur && box.blur(); }catch(_){/* no-op */}
  }

  function bindQuickEvents(){
    if (!pop) return;
    pop.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        dbg('mode-switch click', {from: mode, to: btn.getAttribute('data-mode')});
        const newMode = btn.getAttribute('data-mode');
        if (mode === newMode) return;
        mode = newMode;
        if (box) { box.focus(); }
        const q = box ? box.value.trim() : '';
        if (q){
          onInput(); // 直接用当前查询按新模式搜索
        } else {
          render([], '', 0); // 显示入口 tabs
        }
      });
    });

    // 捕获阶段事件代理：即使 DOM 被重建也能响应；并在最早时机设置保护与阻止冒泡
    document.addEventListener('click', (e)=>{
      const t = e.target;
      if (!t) return;
      const hitToggle = t.closest && t.closest('#'+TOGGLE_ID);
      const hitBack = t.closest && t.closest('#'+BACK_ID);
      if (hitToggle){
        dbg('delegate toggle(click,capture)');
        lastOpenAt = Date.now() + 500; // 提前加大保护
        e.stopPropagation();
        e.preventDefault();
        openMobile();
      } else if (hitBack){
        dbg('delegate back(click,capture)');
        e.stopPropagation();
        e.preventDefault();
        closeMobile();
      }
    }, true);
  }

  function moveActive(delta){
    const links = pop ? Array.from(pop.querySelectorAll('.search-item')) : [];
    if (!links.length) return;
    activeIndex = (activeIndex + delta + links.length) % links.length;
    links.forEach((a, i)=> a.classList.toggle('is-active', i===activeIndex));
    const active = links[activeIndex];
    if (active && active.scrollIntoView){ active.scrollIntoView({block:'nearest'}); }
  }

  function openActive(){
    const a = pop ? pop.querySelector('.search-item.is-active') : null;
    if (a) { window.location.href = a.getAttribute('href'); }
  }

  const onInput = debounce(async function(){
    if (!box) return;
    const q = box.value.trim();
    if (!q){ render([], '', 0); return; }
    const qLower = q.toLowerCase();
    const qWords = tokenize(q);
    let items = [];
    let total = 0;
    if (mode === 'page'){
      const docs = buildPageIndex();
      const scored = docs.map(d => ({ d, s: scoreDoc(d, qWords, qLower) }))
        .filter(x => x.s > 0)
        .sort((a,b)=> b.s - a.s);
      // 仅保留真正有高亮的行
      const filtered = [];
      scored.forEach(x => {
        const line = buildLineSnippet(x.d, qWords, qLower);
        if (line && line.indexOf('<mark>') !== -1){ filtered.push(x.d); }
      });
      total = filtered.length;
      items = filtered; // 本页：全部显示
    } else {
      // 全站/Posts 模式：若索引未就绪，优先提示+空结果，避免长时间卡顿
      if (indexStatus !== 'ready'){
        render([], q, 0);
        return;
      }
      const siteDocs = await ensureData();
      const docs = (mode === 'posts') ? siteDocs.filter(d => (d.section||'') === 'post') : siteDocs;
      const scored = docs.map(d => ({ d, s: scoreDoc(d, qWords, qLower) }))
        .filter(x => x.s > 0);

      // 按“文章（规范化路径）”去重：同一文章仅保留最高得分项
      const bestByPath = new Map();
      for (const x of scored){
        const key = normalizeUrlPath(x.d.url || '');
        const prev = bestByPath.get(key);
        if (!prev || x.s > prev.s){ bestByPath.set(key, x); }
      }
      const unique = Array.from(bestByPath.values()).sort((a,b)=> b.s - a.s);
      total = unique.length; // 用“文章数”作为总计数
      items = unique.map(x => x.d); // 不截断，交由 render 做渐进加载
      // 记录状态供“显示更多”使用
      lastResults = items;
      lastTotal = total;
      lastQuery = q;
      visibleCount = MAX_RESULTS; // 初始显示量
    }
    activeIndex = items.length ? 0 : -1;
    render(items, q, total);
  }, 120);

  function closePopover(){ if (pop){ pop.hidden = true; } }

  function onDocClick(e){
    if (!pop || pop.hidden) return;
    // 打开后的短时间内忽略文档点击，避免某些浏览器的事件顺序导致闪闭
    const delta = Date.now() - lastOpenAt;
    dbg('doc event', e.type, { delta, popHidden: !!(pop && pop.hidden), mobile: document.body.classList.contains('mobile-searching') });
    if (delta < 400) { dbg('doc event ignored by guard'); return; }
    // 在输入框、图标容器或弹窗内部点击都不关闭
    const within = e.target.closest('#'+POPOVER_ID)
      || e.target.closest('#'+INPUT_ID)
      || e.target.closest('.site-search')
      || e.target.closest('#'+TOGGLE_ID)
      || e.target.closest('#'+BACK_ID);
    if (!within){
      dbg('doc event closing popover (outside click)');
      closePopover();
      document.body.classList.remove('mobile-searching');
    }
  }

  function focusHotkey(e){
    if (e.key === '/' && !(e.ctrlKey||e.metaKey||e.altKey) && document.activeElement !== box){
      e.preventDefault(); box && box.focus();
    }
  }

  function setup(){
    box = $(INPUT_ID);
    pop = $(POPOVER_ID);
    toggleBtn = $(TOGGLE_ID);
    backBtn = $(BACK_ID);
    dbg('setup', { box: !!box, pop: !!pop, toggleBtn: !!toggleBtn, backBtn: !!backBtn });
    if (!box || !pop) return;

    // 页面加载即尝试从缓存填充，并在后台预取最新索引（SWR）
    loadIndexFromCache();
    prefetchIndex();

    box.addEventListener('compositionstart', ()=> { isComposing = true; dbg('compositionstart'); });
    box.addEventListener('compositionend', ()=> { isComposing = false; dbg('compositionend'); onInput(); });
    box.addEventListener('input', ()=> { if (!isComposing) { dbg('input'); onInput(); } });
    box.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape'){ dbg('escape close'); closePopover(); document.body.classList.remove('mobile-searching'); return; }
      if (e.key === 'ArrowDown'){ e.preventDefault(); moveActive(1); }
      if (e.key === 'ArrowUp'){ e.preventDefault(); moveActive(-1); }
      if (e.key === 'Enter'){ const a = pop && pop.querySelector('.search-item.is-active'); if (a){ e.preventDefault(); window.location.href = a.getAttribute('href'); } }
    });

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', focusHotkey);

    // 初始显示快捷入口（聚焦时且为空）
    box.addEventListener('focus', () => { dbg('focus', { empty: !box.value.trim() }); if (!box.value.trim()){ render([], '', 0); } });

    // 绑定移动端按钮（仅 click，避免重复与竞态）
    if (toggleBtn){ toggleBtn.addEventListener('click', (e)=>{ dbg('toggle click'); e.preventDefault(); openMobile(); }); }
    if (backBtn){ backBtn.addEventListener('click', (e)=>{ dbg('back click'); e.preventDefault(); closeMobile(); }); }

    // 视口变化：放大到桌面时自动收起
    const mq = window.matchMedia('(min-width: 901px)');
    function onMediaChange(){ dbg('media change', { desktop: mq.matches }); if (mq.matches){ document.body.classList.remove('mobile-searching'); closePopover(); } }
    if (mq.addEventListener) mq.addEventListener('change', onMediaChange);
    else if (mq.addListener) mq.addListener(onMediaChange);

    // 拦截“本页”结果，平滑滚动并高亮
    pop.addEventListener('click', (e) => {
      const a = e.target.closest('a.search-item');
      if (!a) return;
      try{
        const u = new URL(a.getAttribute('href'), location.href);
        const samePage = u.pathname === location.pathname;
        if (samePage && u.hash){
          e.preventDefault();
          closePopover();
          const id = u.hash.slice(1);
          const el = document.getElementById(id);
          if (el){
            el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
            el.classList.add('search-hit-flash');
            setTimeout(()=> el.classList.remove('search-hit-flash'), 1200);
            if (history && history.pushState){ history.pushState(null, '', u.hash); }
            else { location.hash = u.hash; }
          } else {
            // fallback
            location.href = u.toString();
          }
        }
      }catch(_){/* no-op */}
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
