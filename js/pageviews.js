// Google Analytics 浏览量显示
class PageViewCounter {
    constructor() {
        this.propertyId = 'GA4_PROPERTY_ID'; // 替换为您的 GA4 属性 ID
        this.init();
    }

    async init() {
        // 检查是否已加载 Google Analytics
        if (typeof gtag !== 'undefined') {
            this.displayPageViews();
        } else {
            // 等待 GA 加载
            setTimeout(() => this.init(), 1000);
        }
    }

    async getPageViews(path) {
        try {
            // 这里需要后端 API 来调用 Google Analytics Reporting API
            const response = await fetch(`/api/pageviews?path=${encodeURIComponent(path)}`);
            const data = await response.json();
            return data.pageviews || 0;
        } catch (error) {
            console.error('获取浏览量失败:', error);
            return 0;
        }
    }

    async displayPageViews() {
        const articles = document.querySelectorAll('.post-item, .article-item');
        
        for (const article of articles) {
            const link = article.querySelector('a[href]');
            if (link) {
                const path = new URL(link.href).pathname;
                const pageviews = await this.getPageViews(path);
                
                // 创建浏览量显示元素
                const viewsElement = document.createElement('span');
                viewsElement.className = 'pageviews';
                viewsElement.innerHTML = `<i class="icon-eye"></i> ${pageviews} 次浏览`;
                
                // 插入到文章元信息中
                const metaElement = article.querySelector('.post-meta, .article-meta');
                if (metaElement) {
                    metaElement.appendChild(viewsElement);
                }
            }
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new PageViewCounter();
});
