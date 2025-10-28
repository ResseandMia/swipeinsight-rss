const puppeteer = require('puppeteer');
const { Feed } = require('feed');
const fs = require('fs');

(async () => {
    console.log('🚀 启动浏览器...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 访问 SwipeInsight...');
    
    try {
        await page.goto('https://web.swipeinsight.app/app/for-you', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('⏳ 等待内容加载...');
        await page.waitForSelector('div.article', { timeout: 15000 });
        
        // 额外等待确保内容完全加载
        await page.waitForTimeout(2000);
        
        console.log('📊 提取文章数据...');
        const items = await page.evaluate(() => {
            const articles = [];
            const articleElements = document.querySelectorAll('div.article');
            
            console.log(`找到 ${articleElements.length} 个文章元素`);
            
            articleElements.forEach((article, index) => {
                try {
                    const titleElement = article.querySelector('h2 a');
                    const descElement = article.querySelector('section p');
                    const imgElement = article.querySelector('img');
                    const articleId = article.getAttribute('data-article-id');
                    
                    if (titleElement && titleElement.href) {
                        const title = titleElement.innerText.trim();
                        const link = titleElement.href;
                        const description = descElement ? descElement.innerText.trim() : '无描述';
                        const image = imgElement ? imgElement.src : '';
                        
                        articles.push({
                            title: title || `文章 ${index + 1}`,
                            link: link,
                            description: description,
                            image: image,
                            id: articleId || link
                        });
                    }
                } catch (err) {
                    console.error(`处理第 ${index + 1} 篇文章时出错:`, err.message);
                }
            });
            
            return articles;
        });
        
        await browser.close();
        
        console.log(`✅ 成功提取 ${items.length} 篇文章`);
        
        if (items.length === 0) {
            console.warn('⚠️ 警告：没有提取到任何文章');
            process.exit(1);
        }
        
        // 生成 RSS Feed
        const feed = new Feed({
            title: "SwipeInsight - For You 每日精选",
            description: "SwipeInsight 推荐内容自动订阅",
            id: "https://web.swipeinsight.app/app/for-you",
            link: "https://web.swipeinsight.app/app/for-you",
            language: "zh-CN",
            image: "https://web.swipeinsight.app/images/swipe-insight-og-image.webp",
            favicon: "https://web.swipeinsight.app/favicon.ico",
            copyright: "SwipeInsight",
            updated: new Date(),
            generator: "GitHub Actions Puppeteer RSS Generator",
            feedLinks: {
                rss2: "https://ResseandMia.github.io/swipeinsight-rss/feed.xml"
            }
        });
        
        items.forEach(item => {
            let htmlDescription = item.description;
            
            // 如果有图片，添加到描述开头
            if (item.image) {
                htmlDescription = `<img src="${item.image}" style="max-width:100%; height:auto; margin-bottom:10px;"><br><br>${htmlDescription}`;
            }
            
            feed.addItem({
                title: item.title,
                id: item.id,
                link: item.link,
                description: htmlDescription,
                content: htmlDescription,
                date: new Date(),
                image: item.image || undefined
            });
        });
        
        // 保存为 XML 文件
        const rssContent = feed.rss2();
        fs.writeFileSync('feed.xml', rssContent, 'utf8');
        
        console.log('✨ RSS feed 生成成功！');
        console.log(`📦 文件大小: ${(rssContent.length / 1024).toFixed(2)} KB`);
        console.log(`📝 包含文章: ${items.length} 篇`);
        
    } catch (error) {
        console.error('❌ 发生错误:', error.message);
        await browser.close();
        process.exit(1);
    }
})();
