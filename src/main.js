import { Actor } from 'apify';
import { chromium } from 'playwright';

await Actor.init();

// Function to decode Google News URL using Playwright
async function decodeGoogleNewsUrl(googleUrl) {
    console.log(`Decoding: ${googleUrl}`);
    
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Listen for the redirect
        let finalUrl = googleUrl;
        
        page.on('response', (response) => {
            if (response.status() >= 300 && response.status() < 400) {
                const location = response.headers()['location'];
                if (location && !location.includes('google.com')) {
                    finalUrl = location;
                }
            }
        });
        
        // Navigate to the Google News URL
        await page.goto(googleUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });
        
        // Get the final URL after redirect
        finalUrl = page.url();
        
        // If still on Google, wait a bit for client-side redirect
        if (finalUrl.includes('google.com')) {
            await page.waitForTimeout(2000);
            finalUrl = page.url();
        }
        
        console.log(`Decoded to: ${finalUrl}`);
        return finalUrl;
        
    } catch (error) {
        console.error(`Failed to decode: ${error.message}`);
        return googleUrl;
    } finally {
        await browser.close();
    }
}

const input = await Actor.getInput();
const { articlesJson } = input;

const articles = JSON.parse(articlesJson);
console.log(`Processing ${articles.length} URLs...`);

const results = [];

for (const article of articles) {
    let actualUrl = article.link;
    
    if (article.link.includes('news.google.com/rss/articles/')) {
        actualUrl = await decodeGoogleNewsUrl(article.link);
    }
    
    results.push({
        title: article.title,
        originalLink: article.link,
        actualLink: actualUrl,
        guid: article.guid,
        pubDate: article.pubDate,
        decodedAt: new Date().toISOString()
    });
}

await Actor.pushData(results);
console.log(`Done! Processed ${results.length} URLs`);

await Actor.exit();
