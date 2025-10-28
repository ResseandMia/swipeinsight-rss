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
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 访问 SwipeInsight...');
    
    try {
        const response = await page.goto('https://web.swipeinsight.app/app/for-you', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        
        console.log(`📡 响应状态: ${response.status()}`);
        
        // 等待页面加载
        console.log('⏳ 等待内容加载...');
        await page.waitForTimeout(5000);
        
        // 截图调试
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
        console.log('📸 已保存截图到 debug-screenshot.png');
        
        // 获取页面 HTML
        const html = await page.content();
        console.log(`📄 页面 HTML 长度: ${html.length} 字符`);
        
        // 尝试多种选择器
        console.log('🔍 尝试查找文章元素...');
        
        const selectors = [
            'div.article',
            'div[data-article-id]',
            'article',
            '[class*="article"]',
            '[class*="card"]',
            'div[class*="post"]'
        ];
        
        let articleElements = null;
        let usedSelector = '';
        
        for (const selector of selectors) {
            try {
                articleElements = await page.$$(selector);
                if (articleElements && articleElements.length > 0) {
                    usedSelector = selector;
                    console.log(`✅ 使用选择器 "${selector}" 找到 ${articleElements.length} 个元素`);
                    break;
                }
            } catch (err) {
                console.log(`❌ 选择器 "${selector}" 失败: ${err.message}`);
            }
        }
        
        if (!articleElements || articleElements.length === 0) {
            console.error('❌ 未找到任何文章元素！');
            console.log('📋 页面预览:');
            console.log(html.substring(0, 2000));
            
            // 保存完整 HTML 用于调试
            fs.writeFileSync('debug-page.html', html, 'utf8');
            console.log('💾 已保存完整 HTML 到 debug-page.html');
            
            await browser.close();
            process.exit(1);
        }
        
        console.log('📊 提取文章数据...');
        const items = [];
        
        for (let i = 0; i < Math.min(articleElements.length, 20); i++) {
            try {
                const article = articleElements[i];
                
                // 提取标题
                const titleElement = await article.$('h2 a, h3 a, a[class*="title"], h2, h3');
                const title = titleElement ? await page.evaluate(el => el.textContent.trim(), titleElement) : null;
                
                // 提取链接
                const linkElement = await article.$('a');
                let link = linkElement ? await page.evaluate(el => el.href, linkElement) : null;
                
                // 提取描述
                const descElement = await article.$('p, div[class*="description"], div[class*="content"]');
                const description = descElement ? await page.evaluate(el => el.textContent.trim(), descElement) : '';
                
                // 提取图片
                const imgElement = await article.$('img');
                const image = imgElement ? await page.evaluate(el => el.src, imgElement) : '';
                
                // 提取 ID
                const articleId = await page.evaluate(el => el.getAttribute('data-article-id'), article);
                
                if (title && link) {
                    items.push({
                        title: title,
                        link: link,
                        description: description || '无描述',
                        image: image,
                        id: articleId || link
                    });
                    
                    console.log(`  [${i + 1}] ${title.substring(0, 50)}...`);
                }
            } catch (err) {
                console.error(`处理第 ${i + 1} 篇文章时出错: ${err.message}`);
            }
        }
        
        await browser.close();
        
        console.log(`\n✅ 成功提取 ${items.length} 篇文章`);
        
        if (items.length === 0) {
            console.error('⚠️ 没有提取到任何有效文章');
            process.exit(1);
        }
        
        // 生成 RSS Feed
        const feed = new Feed({
            title: "SwipeInsight - For You 每日精选",
            description: "SwipeInsight 推荐内容自动订阅",
            id: "https://web.swipeinsight.app/app/for-you",
            link: "https://web.swipeinsight.app/app/for-you",
            language: "zh-CN",
            updated: new Date(),
            generator: "GitHub Actions Puppeteer RSS Generator"
        });
        
        items.forEach(item => {
            let htmlDescription = item.description;
            
            if (item.image) {
                htmlDescription = `<img src="${item.image}" style="max-width:100%; height:auto;"><br><br>${htmlDescription}`;
            }
            
            feed.addItem({
                title: item.title,
                id: item.id,
                link: item.link,
                description: htmlDescription,
                content: htmlDescription,
                date: new Date()
            });
        });
        
        const rssContent = feed.rss2();
        fs.writeFileSync('feed.xml', rssContent, 'utf8');
        
        console.log('\n✨ RSS feed 生成成功！');
        console.log(`📦 文件大小: ${(rssContent.length / 1024).toFixed(2)} KB`);
        console.log(`📝 包含文章: ${items.length} 篇`);
        
    } catch (error) {
        console.error('❌ 发生错误:', error);
        await browser.close();
        process.exit(1);
    }
})();
