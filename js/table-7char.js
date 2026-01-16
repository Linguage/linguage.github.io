document.addEventListener('DOMContentLoaded', () => {
  const tables = document.querySelectorAll('table:not(.no-adaptive)');

  tables.forEach((table) => {
    table.classList.add('adaptive-table', 'table-fixed', 'w-full');

    table.querySelectorAll('th').forEach(th => th.classList.add('whitespace-nowrap'));
    table.querySelectorAll('td').forEach(td => td.classList.add('break-words', 'align-top'));

    const cells = table.querySelectorAll('tbody td');
    let tableHasMedia = false;

    cells.forEach((cell) => {
      // 1. Ensure cell-inner exists with default clamp styles (matching table-tooltips.js)
      let wrapper = cell.querySelector('.cell-inner');
      if (!wrapper) {
        wrapper = document.createElement('div');
        // Default clamp state: line-clamp-3, overflow-hidden, etc.
        wrapper.className = 'cell-inner line-clamp-3 overflow-hidden text-ellipsis';
        wrapper.style.display = '-webkit-box';
        wrapper.style.webkitBoxOrient = 'vertical';
        
        while (cell.firstChild) {
          wrapper.appendChild(cell.firstChild);
        }
        cell.appendChild(wrapper);
      }

      const hasMedia = cell.querySelector('img, picture, video, iframe, object, embed, svg');
      if (hasMedia) {
        cell.classList.add('cell-media');
        // Media cells: unclamp
        cell.classList.remove('whitespace-nowrap'); // ensure no nowrap
        wrapper.classList.remove('line-clamp-3', 'overflow-hidden', 'text-ellipsis');
        wrapper.style.display = 'block';
        tableHasMedia = true;
        return;
      }

      const text = cell.textContent.replace(/\s+/g, '').trim();
      if (text.length > 0 && text.length <= 7) {
        // Short content: nowrap, unclamp
        cell.classList.add('whitespace-nowrap');
        wrapper.classList.remove('line-clamp-3', 'overflow-hidden', 'text-ellipsis');
        wrapper.style.display = 'inline'; // or block/flex but inline works for nowrap-7 logic
      } else {
        // Normal content: allow wrap (default), ensure clamp is active (if not expanded)
        cell.classList.remove('whitespace-nowrap');
        // We don't force-add clamp classes here because user might have expanded it manually? 
        // But this runs on load, so we should ensure defaults.
        // If table-tooltips runs later, it might touch it. 
        // Safe to ensure default state if it's not marked as expanded.
        if (!cell.classList.contains('is-expanded')) {
            wrapper.classList.add('line-clamp-3', 'overflow-hidden', 'text-ellipsis');
            wrapper.style.display = '-webkit-box';
        }
      }
    });

    if (tableHasMedia) {
      table.classList.add('adaptive-table-media');
    }
  });
});
