(function(){
  function $(selector, root){ return (root || document).querySelector(selector); }
  function on(el, evt, handler){ el && el.addEventListener(evt, handler, false); }

  function setup(){
    var overlay = $('#social-popup-overlay');
    if (!overlay) return;

    var card = $('.social-popup-card', overlay);
    var imgEl = $('.social-popup-image', overlay);
    var titleEl = $('.social-popup-title', overlay);
    var descEl = $('.social-popup-desc', overlay);
    var closeBtn = $('.social-popup-close', overlay);

    function openPopup(image, title, desc){
      if (!imgEl) return;
      imgEl.src = image || '';
      imgEl.alt = title || '';
      if (titleEl) titleEl.textContent = title || '';
      if (descEl) descEl.textContent = desc || '';
      
      // Tailwind visibility toggle
      overlay.classList.remove('opacity-0', 'pointer-events-none');
      overlay.classList.add('opacity-100', 'pointer-events-auto');
      
      // Card animation
      if (card) {
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
      }

      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('popup-open');
    }

    function closePopup(){
      // Tailwind visibility toggle
      overlay.classList.remove('opacity-100', 'pointer-events-auto');
      overlay.classList.add('opacity-0', 'pointer-events-none');
      
      // Card animation
      if (card) {
        card.classList.remove('scale-100');
        card.classList.add('scale-95');
      }

      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('popup-open');
      
      // Clear content after transition to avoid flicker
      setTimeout(function(){
        if (imgEl){
          imgEl.src = '';
          imgEl.alt = '';
        }
      }, 300);
    }

    on(closeBtn, 'click', closePopup);
    on(overlay, 'click', function(evt){
      if (evt.target === overlay) closePopup();
    });
    on(document, 'keyup', function(evt){
      // Check for opacity class instead of is-visible
      if (evt.key === 'Escape' && overlay.classList.contains('opacity-100')){
        closePopup();
      }
    });

    document.querySelectorAll('.js-social-popup').forEach(function(el){
      on(el, 'click', function(evt){
        evt.preventDefault();
        var image = el.getAttribute('data-popup-image');
        if (!image) return;
        var title = el.getAttribute('data-popup-title') || '';
        var desc = el.getAttribute('data-popup-desc') || '';
        openPopup(image, title, desc);
      });
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
