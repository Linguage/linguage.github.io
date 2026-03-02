document.addEventListener('DOMContentLoaded', () => {
    // 为所有的 .highlight 代码框添加复制按钮
    const highlightBlocks = document.querySelectorAll('.highlight');
    
    highlightBlocks.forEach((highlightBlock) => {
        // 创建按钮
        const button = document.createElement('button');
        button.className = 'copy-code-button';
        // 使用一个简单的复制图标 SVG
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
        button.setAttribute('aria-label', 'Copy code to clipboard');
        button.setAttribute('title', 'Copy');
        
        // 将按钮添加到 highlight 容器中
        // 我们在 CSS 中会将 .highlight 设置为 position: relative
        highlightBlock.appendChild(button);
        
        button.addEventListener('click', async () => {
            // 获取代码内容
            // 由于使用了行号表，真正的代码在最后一个 <td> 里的 <pre> 标签内
            const codeContainer = highlightBlock.querySelector('.lntd:last-child pre') || highlightBlock.querySelector('pre');
            
            if (!codeContainer) return;
            
            // 提取纯文本代码，去掉不必要的换行和格式
            let textToCopy = codeContainer.innerText;
            // 移除可能在末尾多出来的空行（Hugo Chroma 常见情况）
            if (textToCopy.endsWith('\n')) {
                textToCopy = textToCopy.slice(0, -1);
            }
            
            try {
                // 使用现代 Clipboard API
                await navigator.clipboard.writeText(textToCopy);
                
                // 成功动画
                button.classList.add('copied');
                button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`;
                
                // 2秒后恢复原状
                setTimeout(() => {
                    button.classList.remove('copied');
                    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy code: ', err);
            }
        });
    });
});
