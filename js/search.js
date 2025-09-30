(function(){
  async function fetchIndex(){
    try{
      const res = await fetch('/index.json', { credentials: 'same-origin' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(err){
      console.error('Failed to load search index:', err);
      return [];
    }
  }

  function getQuery(){
    const q = new URLSearchParams(location.search).get('q') || '';
    return q.trim();
  }
  function buildFuse(docs){
    if (typeof Fuse === 'undefined') return null;
    return new Fuse(docs, {
      includeScore: true,
      includeMatches: true,
      threshold: 0.33,
      ignoreLocation: true,
      minMatchCharLength: 2,
      // 优先 frontmatter（title/description/summary/tags/categories），内容次之
      keys: [
        { name: 'title', weight: 0.40 },
        { name: 'description', weight: 0.30 },
        { name: 'summary', weight: 0.15 },
        { name: 'tags', weight: 0.08 },
        { name: 'categories', weight: 0.05 },
        { name: 'content', weight: 0.02 }
      ]
    });
  }

  function highlight(text, indices){
    if (!text || !indices || !indices.length) return text || '';
    // 合并重叠索引并构造高亮
    let out = '';
    let last = 0;
    indices.forEach(([start, end]) => {
      if (start > text.length) return;
      if (start > last) out += text.slice(last, start);
      out += '<mark>' + text.slice(start, end + 1) + '</mark>';
      last = end + 1;
    });
    out += text.slice(last);
    return out;
  }

  function makeSnippets(doc, matches, q){
    // 生成最多三行简洁片段：优先 description/summary/content，不对 title 生成片段
    const sourceOrder = ['description', 'summary', 'content'];
    const snippets = [];
    const seen = new Set(); // for de-dup
    const WINDOW = 140; // 每段字符窗口

    // 将 matches 按字段分组
    const fieldMatches = {};
    (matches || []).forEach(m => {
      const key = m.key || (m.refIndex != null ? 'content' : '');
      if (!key) return;
      if (!fieldMatches[key]) fieldMatches[key] = [];
      fieldMatches[key].push(m);
    });

    for (const field of sourceOrder){
      if (snippets.length >= 3) break;
      const text = (doc[field] || '').toString();
      if (!text) continue;
      const ms = fieldMatches[field] || [];
      if (ms.length){
        let countFromField = 0;
        // 使用匹配位置截取上下文并高亮
        for (const m of ms){
          if (snippets.length >= 3) break;
          if (countFromField >= 2) break; // 限制每字段最多2条，降低冗余
          const idx = (m.indices && m.indices[0]) ? m.indices[0][0] : text.toLowerCase().indexOf(q.toLowerCase());
          const start = Math.max(0, idx - Math.floor(WINDOW/2));
          const end = Math.min(text.length, start + WINDOW);
          const slice = text.slice(start, end);
          // 调整 indices 到切片相对位置
          const indices = (m.indices || []).map(([s,e])=>[Math.max(0,s-start), Math.min(end-start-1, e-start)]).filter(([s,e])=>s<=e && s < slice.length);
          const line = (start>0?'…':'') + highlight(slice, indices) + (end<text.length?'…':'');
          const norm = line.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
          if (!seen.has(norm)){
            seen.add(norm);
            snippets.push(line);
            countFromField++;
          }
        }
      } else if (!matches || !matches.length) {
        // 无匹配信息（如退化到简易过滤），用该字段的起始摘要
        const cut = text.slice(0, WINDOW);
        const line = cut + (text.length>WINDOW?'…':'');
        const norm = line.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
        if (!seen.has(norm)){
          seen.add(norm);
          snippets.push(line);
        }
      }
    }
    return snippets.slice(0,3);
  }

  function dedupeByUrl(results){
    const best = new Map();
    results.forEach(r => {
      const doc = r.item || r;
      const url = doc.url;
      const score = (typeof r.score === 'number') ? r.score : 1;
      if (!best.has(url) || score < best.get(url).score){
        best.set(url, { r, score });
      }
    });
    return Array.from(best.values()).map(x => x.r);
  }

  function render(results){
    const box = document.getElementById('results');
    if(!box) return;
    if(!results.length){ box.innerHTML = '<p>没有结果。</p>'; return; }
    const unique = dedupeByUrl(results);
    box.innerHTML = unique.map(r => {
      const doc = r.item || r; // fuse result or plain object
      const date = doc.date ? `<span style="color:var(--muted)">${doc.date}</span>` : '';
      const meta = `${doc.section||''} ${date}`.trim();
      const matches = r.matches || [];
      const q = getQuery();
      const lines = makeSnippets(doc, matches, q);
      const body = lines.length ? lines.map(l=>`<div>${l}</div>`).join('') : '';
      return `
        <div class="card" style="margin-bottom:12px;">
          <a href="${doc.url}" class="card-title">${doc.title}</a>
          ${body ? `<div class="card-desc">${body}</div>` : ''}
          ${meta ? `<div style="color:var(--muted);font-size:12px;">${meta}</div>` : ''}
        </div>`;
    }).join('');
  }

  function simpleFilter(docs, q){
    const s = (q || '').toLowerCase();
    return docs.filter(d => (
      (d.title||'').toLowerCase().includes(s) ||
      (d.description||'').toLowerCase().includes(s) ||
      (d.summary||'').toLowerCase().includes(s) ||
      (Array.isArray(d.tags) && d.tags.join(' ').toLowerCase().includes(s)) ||
      (Array.isArray(d.categories) && d.categories.join(' ').toLowerCase().includes(s)) ||
      (d.content||'').toLowerCase().includes(s)
    ));
  }

  async function init(){
    const input = document.getElementById('q');
    const docs = await fetchIndex();
    const fuse = buildFuse(docs);

    function doSearch(q){
      if(!q){ render([]); return; }
      let results = [];
      if (fuse){
        results = fuse.search(q).slice(0, 50);
      }else{
        results = simpleFilter(docs, q).slice(0, 50);
      }
      render(results);
    }

    const initQ = getQuery();
    if (input){
      input.value = initQ;
      input.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter'){
          const q = input.value.trim();
          if (q) {
            // keep URL in sync
            const url = new URL(location.href);
            url.searchParams.set('q', q);
            history.replaceState(null, '', url.toString());
          }
          doSearch(q);
        }
      });
      // Optional live search on input
      input.addEventListener('input', ()=>{
        const q = input.value.trim();
        if (!q) render([]);
      });
    }

    if (initQ) doSearch(initQ);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
