(function(){
  if (window.SearchCore) return;
  function escapeRegExp(str){ return str.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function tokenize(q){ return (q||'').toString().toLowerCase().trim().split(/\s+/).filter(Boolean); }
  function normalizeUrlPath(u){ try{ const url=new URL(u, document.baseURI); return url.pathname; }catch(_){ return (u||'').split('#')[0].split('?')[0]; } }
  function fuzzyRegexFromQuery(q){ const chars = q.split('').map(ch=>escapeRegExp(ch)); return new RegExp(chars.join('.*'),'i'); }
  function fuzzyMatchScore(text, q){ if(!q) return 0; try{ const re=fuzzyRegexFromQuery(q); if(re.test(text)){ return Math.min(15, 5 + Math.floor(Math.max(2,q.length)/1.5)); } }catch(_){} return 0; }
  function hasWordBoundary(text, w){ if(!w||w.length<2) return false; if(!/^[a-z0-9'\-]+$/i.test(w)) return false; try{ return new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text);}catch(_){return false;} }
  function coverageBonus(allText, qWords){ if(!qWords||!qWords.length) return 0; const eng=qWords.filter(w=>/^[a-z0-9'\-]+$/i.test(w)&&w.length>=2); if(eng.length<2) return 0; let hit=0; eng.forEach(w=>{ if(hasWordBoundary(allText,w) || allText.includes(w)) hit++; }); if(hit===eng.length) return 36; return Math.floor((hit/eng.length)*12); }
  function scoreDoc(doc, qWords, qLower, mode){
    const title=(doc.title||'').toLowerCase();
    const summary=(doc.summary||'').toLowerCase();
    const content=(doc.content||'').toLowerCase();
    const tags=(doc.tags||[]).join(' ').toLowerCase();
    if (mode==='page'){
      let s=0; qWords.forEach(w=>{ if(hasWordBoundary(content,w)) s+=22; }); qWords.forEach(w=>{ if(content.includes(w)) s+=6; }); if(content.includes(qLower)) s+=20; s+=fuzzyMatchScore(content,qLower); s+=coverageBonus(content,qWords); return s;
    }
    let score=0;
    qWords.forEach(w=>{
      if(hasWordBoundary(title,w)) score+=30;
      if(hasWordBoundary(summary,w)) score+=16;
      if(hasWordBoundary(content,w)) score+=10;
      if(hasWordBoundary(tags,w)) score+=12;
      if(title.includes(w)) score+=12;
      if(summary.includes(w)) score+=6;
      if(content.includes(w)) score+=2;
      if(tags.includes(w)) score+=4;
    });
    if(title.includes(qLower)) score+=20;
    if(summary.includes(qLower)) score+=10;
    if(content.includes(qLower)) score+=3;
    score+=coverageBonus(`${title} ${summary} ${content} ${tags}`, qWords);
    return score;
  }
  function rankAndDedupe(docs, q, opts){
    const mode = (opts && opts.mode) || 'all';
    const qLower=(q||'').toLowerCase();
    const qWords=tokenize(q);
    const scored = docs.map(d=>({ d, s: scoreDoc(d,qWords,qLower,mode) })).filter(x=>x.s>0);
    // 去重到“文章级”（按规范化路径）
    const bestByPath=new Map();
    for(const x of scored){ const key=normalizeUrlPath(x.d.url||''); const prev=bestByPath.get(key); if(!prev||x.s>prev.s){ bestByPath.set(key,x);} }
    const unique=Array.from(bestByPath.values()).sort((a,b)=>b.s-a.s).map(x=>x.d);
    return unique;
  }
  window.SearchCore = { tokenize, escapeRegExp, fuzzyRegexFromQuery, fuzzyMatchScore, hasWordBoundary, scoreDoc, rankAndDedupe, normalizeUrlPath };
})();
