// 简化版浏览量统计（使用本地存储）
class SimplePageViews {
    constructor() {
        this.storageKey = 'linguage_pageviews';
        this.init();
    }

    init() {
        // 记录当前页面浏览
        this.recordPageView();
        // 显示浏览量
        this.displayPageViews();
    }

    recordPageView() {
        const currentPath = window.location.pathname;
        const views = this.getStoredViews();
        
        // 增加当前页面浏览量
        views[currentPath] = (views[currentPath] || 0) + 1;
        
        // 存储到本地
        localStorage.setItem(this.storageKey, JSON.stringify(views));
        
        // 发送到 Google Analytics（如果已加载）
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', {
                page_title: document.title,
                page_location: window.location.href,
                page_path: currentPath
            });
        }
    }

    getStoredViews() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            return {};
        }
    }

    getPageViews(path) {
        const views = this.getStoredViews();
        return views[path] || 0;
    }

    displayPageViews() {
        // 在首页显示总浏览量
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            this.showTotalViews();
        }
        
        // 在文章页面显示当前页面浏览量
        this.showCurrentPageViews();
        
        // 在文章列表中显示各文章浏览量
        this.showPostListViews();
    }

    showTotalViews() {
        const views = this.getStoredViews();
        const totalViews = Object.values(views).reduce((sum, count) => sum + count, 0);
        
        // 查找合适的位置插入总浏览量
        const header = document.querySelector('.header, .site-header, h1');
        if (header && totalViews > 0) {
            const totalViewsElement = document.createElement('div');
            totalViewsElement.className = 'total-pageviews';
            totalViewsElement.innerHTML = `
                <span class="pageview-counter">
                    <i class="icon-eye"></i> 总浏览量: ${totalViews.toLocaleString()}
                </span>
            `;
            header.appendChild(totalViewsElement);
        }
    }

    showCurrentPageViews() {
        const currentPath = window.location.pathname;
        const views = this.getPageViews(currentPath);
        
        if (views > 0) {
            // 查找文章元信息区域
            const metaElement = document.querySelector('.post-meta, .page-meta, .entry-meta');
            if (metaElement) {
                const viewsElement = document.createElement('span');
                viewsElement.className = 'current-pageviews';
                viewsElement.innerHTML = `<i class="icon-eye"></i> ${views} 次浏览`;
                metaElement.appendChild(viewsElement);
            }
        }
    }

    showPostListViews() {
        // 在文章列表中显示浏览量
        const postItems = document.querySelectorAll('.post-item, .list__item, .entry');
        
        postItems.forEach(item => {
            const link = item.querySelector('a[href]');
            if (link) {
                try {
                    const path = new URL(link.href, window.location.origin).pathname;
                    const views = this.getPageViews(path);
                    
                    if (views > 0) {
                        const metaElement = item.querySelector('.post-meta, .entry-meta, .list__meta');
                        if (metaElement) {
                            const viewsElement = document.createElement('span');
                            viewsElement.className = 'post-pageviews';
                            viewsElement.innerHTML = `<i class="icon-eye"></i> ${views}`;
                            metaElement.appendChild(viewsElement);
                        }
                    }
                } catch (error) {
                    console.error('解析链接失败:', error);
                }
            }
        });
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new SimplePageViews();
});
