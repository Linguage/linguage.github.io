(function(){
  function ensureCellInner(table){
    const tds = table.querySelectorAll('td');
    tds.forEach(td => {
      // 跳过明确标记不启用的单元格
      if (td.classList.contains('no-clamp')) return;
      const hasMedia = td.querySelector('img, picture, video, iframe, object, embed, svg');
      // 媒体单元格不截断、也不浮层
      if (hasMedia) return;
      if (!td.querySelector(':scope > .cell-inner')){
        const wrap = document.createElement('div');
        wrap.className = 'cell-inner';
        while (td.firstChild){ wrap.appendChild(td.firstChild); }
        td.appendChild(wrap);
      }
    });
  }

  function isClamped(el){
    if (!el) return false;
    // 使用 scrollHeight 与 clientHeight 判断是否被三行截断
    return el.scrollHeight - 1 > el.clientHeight; // 留 1px 容差
  }

  function updateClampMarkers(root){
    const cells = (root || document).querySelectorAll('td .cell-inner');
    cells.forEach(inner => {
      const td = inner.parentElement;
      if (isClamped(inner)){
        td.classList.add('has-clamp');
      } else {
        td.classList.remove('has-clamp');
      }
    });
  }

  // 内联展开/收起
  function expandCell(td){ td.classList.add('is-expanded'); }
  function collapseCell(td){ td.classList.remove('is-expanded'); }
  function toggleCell(td){ td.classList.toggle('is-expanded'); }

  function attach(){
    const tables = document.querySelectorAll('table');
    tables.forEach(table => { if (!table.classList.contains('no-tooltips')) ensureCellInner(table); });

    // 点击展开/收起（仅折叠单元格）
    document.addEventListener('click', (e) => {
      const td = e.target.closest('td');
      if (!td || !td.querySelector('.cell-inner')) return;
      const inner = td.querySelector('.cell-inner');
      const isCollapsedClamped = isClamped(inner) && !td.classList.contains('is-expanded');

      // 若点击的是交互元素
      const interactive = e.target.closest('a, button, input, textarea, select, label');
      if (interactive){
        if (interactive.tagName.toLowerCase() === 'a' && isCollapsedClamped){
          // 第一次点击链接：先展开，不跳转
          e.preventDefault();
          expandCell(td);
          return;
        }
        // 其他交互：若已折叠保持默认行为；若已展开则正常交互
        return;
      }

      if (!isClamped(inner) && !td.classList.contains('is-expanded')) return;
      toggleCell(td);
    });

    // 键盘可达：为 has-clamp 的 td 添加 tabindex，并用 Enter/Space 切换
    function refreshTabIndex(){
      document.querySelectorAll('td.has-clamp').forEach(td => td.tabIndex = 0);
    }
    refreshTabIndex();
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const td = e.target.closest && e.target.closest('td.has-clamp');
      if (!td) return;
      e.preventDefault();
      toggleCell(td);
    });

    // 点击页面空白处收起所有展开项
    document.addEventListener('click', (e) => {
      const expanded = document.querySelectorAll('td.is-expanded');
      if (!expanded.length) return;
      const td = e.target.closest && e.target.closest('td.is-expanded');
      if (td) return; // 点在展开单元格内，不收起
      expanded.forEach(collapseCell);
    });

    // 窗口变化时重定位
    window.addEventListener('resize', () => {
      updateClampMarkers();
      // 若某单元格已展开但现已不折叠，移除展开态
      document.querySelectorAll('td.is-expanded').forEach(td => {
        const inner = td.querySelector('.cell-inner');
        if (!isClamped(inner)) collapseCell(td);
      });
      // 更新可聚焦性
      refreshTabIndex();
    });

    // 初始打标 + 可聚焦性
    updateClampMarkers();
    refreshTabIndex();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
