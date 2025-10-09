// Simple site-wide search with popover results
// Data source: /index.json produced by Hugo SearchIndex output
(function(){
  const INPUT_ID = 'globalSearchInput';
  const POPOVER_ID = 'globalSearchPopover';
  const MAX_RESULTS = 10;
  // 使用相对路径，确保在子路径部署（如 /project/）下可访问
  const FETCH_URL = 'index.json';

  // modes: all | posts | page
  let mode = 'all';
  let data = null;        // site index
  let pageData = null;    // current page index
  let box = null;
  let pop = null;
  let activeIndex = -1;
  let isComposing = false;

  function $(id){ return document.getElementById(id); }

  function debounce(fn, delay){ let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }

  async function ensureData(){
    if (data) return data;
    try{
      const res = await fetch(FETCH_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      data = await res.json();
    }catch(err){
      console.error('[search] failed to load', err);
      data = [];
    }
    return data;
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

    pop.innerHTML = tabsHtml;
    pop.hidden = false;
    bindQuickEvents();

    if (!q) return;

    const qWords = tokenize(q);
    const qLower = q.toLowerCase();
    const modeLabel = mode==='all'?'全站':(mode==='posts'?'Posts':'本页');
    const header = `<div class="search-popover-header">【${modeLabel}】找到 ${total} 个结果 · 按 ↑/↓ 选择，Enter 打开，Esc 关闭</div>`;
    let list = '';
    if (mode === 'page'){
      const parts = [];
      items.forEach((it, i)=>{
        const line = buildLineSnippet(it, qWords, qLower);
        if (!line || line.indexOf('<mark>') === -1) return; // 仅保留真正命中的行
        const cls = 'search-item'+(i===activeIndex?' is-active':'');
        parts.push(`<a class="${cls}" data-index="${i}" href="${it.url}">\
          <div class="search-item-line">${line}</div>\
        </a>`);
      });
      list = parts.join('');
    } else {
      list = items.map((it, i)=>{
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
  }

  function bindQuickEvents(){
    if (!pop) return;
    pop.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
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
      const siteDocs = await ensureData();
      const docs = (mode === 'posts') ? siteDocs.filter(d => (d.section||'') === 'post') : siteDocs;
      const scored = docs.map(d => ({ d, s: scoreDoc(d, qWords, qLower) }))
        .filter(x => x.s > 0)
        .sort((a,b)=> b.s - a.s);
      total = scored.length;
      items = scored.slice(0, MAX_RESULTS).map(x => x.d);
    }
    activeIndex = items.length ? 0 : -1;
    render(items, q, total);
  }, 120);

  function closePopover(){ if (pop){ pop.hidden = true; } }

  function onDocClick(e){
    if (!pop || pop.hidden) return;
    const within = e.target.closest('#'+POPOVER_ID) || e.target.closest('#'+INPUT_ID);
    if (!within) closePopover();
  }

  function focusHotkey(e){
    if (e.key === '/' && !(e.ctrlKey||e.metaKey||e.altKey) && document.activeElement !== box){
      e.preventDefault(); box && box.focus();
    }
  }

  function setup(){
    box = $(INPUT_ID);
    pop = $(POPOVER_ID);
    if (!box || !pop) return;

    box.addEventListener('compositionstart', ()=> isComposing = true);
    box.addEventListener('compositionend', ()=> { isComposing = false; onInput(); });
    box.addEventListener('input', ()=> { if (!isComposing) onInput(); });
    box.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape'){ closePopover(); return; }
      if (e.key === 'ArrowDown'){ e.preventDefault(); moveActive(1); }
      if (e.key === 'ArrowUp'){ e.preventDefault(); moveActive(-1); }
      if (e.key === 'Enter'){ const a = pop && pop.querySelector('.search-item.is-active'); if (a){ e.preventDefault(); window.location.href = a.getAttribute('href'); } }
    });

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', focusHotkey);

    // 初始显示快捷入口（聚焦时且为空）
    box.addEventListener('focus', () => { if (!box.value.trim()){ render([], '', 0); } });

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
