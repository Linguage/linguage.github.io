document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('pg-section')) {
    return;
  }

  const cells = document.querySelectorAll('body.pg-section table tbody td');
  cells.forEach((cell) => {
    const text = cell.textContent.replace(/\s+/g, '').trim();
    if (text.length > 0 && text.length <= 7) {
      cell.classList.add('nowrap-7');
    }
  });
});
