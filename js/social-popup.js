(function(){
  function $(selector, root){ return (root || document).querySelector(selector); }
  function on(el, evt, handler){ el && el.addEventListener(evt, handler, false); }

  function setup(){
    var overlay = $('#social-popup-overlay');
    if (!overlay) return;

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
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('popup-open');
    }

    function closePopup(){
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('popup-open');
      if (imgEl){
        imgEl.src = '';
        imgEl.alt = '';
      }
    }

    on(closeBtn, 'click', closePopup);
    on(overlay, 'click', function(evt){
      if (evt.target === overlay) closePopup();
    });
    on(document, 'keyup', function(evt){
      if (evt.key === 'Escape' && overlay.classList.contains('is-visible')){
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
