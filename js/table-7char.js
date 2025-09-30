document.addEventListener('DOMContentLoaded', () => {
  const tables = document.querySelectorAll('table:not(.no-adaptive)');

  tables.forEach((table) => {
    table.classList.add('adaptive-table');

    const cells = table.querySelectorAll('tbody td');
    let tableHasMedia = false;

    cells.forEach((cell) => {
      if (!cell.querySelector('.cell-inner')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cell-inner';
        while (cell.firstChild) {
          wrapper.appendChild(cell.firstChild);
        }
        cell.appendChild(wrapper);
      }

      const hasMedia = cell.querySelector('img, picture, video, iframe, object, embed, svg');
      if (hasMedia) {
        cell.classList.add('cell-media');
        cell.classList.remove('nowrap-7');
        tableHasMedia = true;
        return;
      }

      const text = cell.textContent.replace(/\s+/g, '').trim();
      if (text.length > 0 && text.length <= 7) {
        cell.classList.add('nowrap-7');
      } else {
        cell.classList.remove('nowrap-7');
      }
    });

    if (tableHasMedia) {
      table.classList.add('adaptive-table-media');
    }
  });
});
