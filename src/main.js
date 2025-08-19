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
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v1/scrape',
            {
                url: article.link,
                formats: ['markdown', 'html']
            },
            {
                headers: {
                    'Authorization': `Bearer ${firecrawlApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        results.push({
            ...article,
            markdown: response.data.data?.markdown || '',
            html: response.data.data?.html || '',
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
