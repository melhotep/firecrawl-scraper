import { Actor } from 'apify';
import axios from 'axios';

await Actor.init();

const input = await Actor.getInput();
const { articlesJson, firecrawlApiKey } = input;

// Parse the JSON string
const articles = JSON.parse(articlesJson);

console.log(`Processing ${articles.length} articles...`);

const results = [];
const errors = [];

for (const article of articles) {
    try {
        console.log(`Scraping: ${article.link}`);
        
        // Use Firecrawl v2 API with proper options
        const response = await axios.post(
            'https://api.firecrawl.dev/v2/scrape',
            {
                url: article.link,
                onlyMainContent: true,
                maxAge: 172800000,  // 48 hours cache
                formats: ['markdown', 'html']
            },
            {
                headers: {
                    'Authorization': `Bearer ${firecrawlApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // v2 API response structure
        const scrapedData = response.data.data || response.data;
        
        results.push({
            ...article,
            markdown: scrapedData.markdown || '',
            html: scrapedData.html || '',
            scrapedAt: new Date().toISOString()
        });
        
        console.log(`✓ Successfully scraped: ${article.title}`);
    } catch (error) {
        console.error(`✗ Failed to scrape ${article.link}:`, error.message);
        errors.push({
            article,
            error: error.message
        });
    }
}

await Actor.pushData(results);

if (errors.length > 0) {
    await Actor.setValue('errors', errors);
}

console.log(`Done! Scraped ${results.length} articles, ${errors.length} errors`);

await Actor.exit();
