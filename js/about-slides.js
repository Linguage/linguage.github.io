(function(){
  function qs(sel, ctx){return (ctx||document).querySelector(sel)}
  function qsa(sel, ctx){return Array.from((ctx||document).querySelectorAll(sel))}
  function showSlide(idx){
    const slides = qsa('.about-slides .slide');
    const dots = qsa('.about-slides .slide-dot');
    idx = Math.max(0, Math.min(idx, slides.length - 1));
    slides.forEach((s,i)=>{ s.classList.toggle('active', i===idx) })
    dots.forEach((d,i)=>{ d.classList.toggle('active', i===idx); d.dataset.index=i })
    const container = qs('.about-slides');
    if (container) container.dataset.activeIndex = String(idx);
  }
  function next(delta){
    const container = qs('.about-slides');
    if (!container) return;
    const slides = qsa('.about-slides .slide');
    const cur = parseInt(container.dataset.activeIndex||'0',10)||0;
    let n = (cur + delta + slides.length) % slides.length;
    showSlide(n);
  }
  function initDots(){
    qsa('.about-slides .slide-dot').forEach(dot=>{
      dot.addEventListener('click', ()=>{
        const i = parseInt(dot.dataset.index||'0',10)||0; showSlide(i);
      })
    })
  }
  function initNav(){
    const prev = qs('.about-slides .btn-prev');
    const nextBtn = qs('.about-slides .btn-next');
    if(prev) prev.addEventListener('click', ()=>next(-1));
    if(nextBtn) nextBtn.addEventListener('click', ()=>next(1));
  }
  function initWorkList(){
    const list = qs('.about-slides .work-list');
    const preview = qs('.about-slides .work-preview');
    if(!list || !preview) return;
    const items = qsa('.work-item', list);
    function activate(i){
      items.forEach((li,idx)=>li.classList.toggle('active', idx===i));
      const img = items[i] ? items[i].dataset.preview : '';
      preview.style.backgroundImage = img ? `url(${img})` : 'none';
    }
    items.forEach((li,idx)=>{
      li.addEventListener('mouseenter', ()=>activate(idx));
      li.addEventListener('focus', ()=>activate(idx));
      li.addEventListener('click', ()=>activate(idx));
    })
    if(items.length) activate(0);
  }
  document.addEventListener('DOMContentLoaded', function(){
    showSlide(0);
    initDots();
    initNav();
    initWorkList();
  });
})();
