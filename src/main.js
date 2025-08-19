import { Actor } from 'apify';
import axios from 'axios';

await Actor.init();

const input = await Actor.getInput();
const { articles = [], firecrawlApiKey } = input;

if (!firecrawlApiKey) {
    throw new Error('Firecrawl API key is required! Get one free at https://www.firecrawl.dev');
}

console.log(`Processing ${articles.length} articles with Firecrawl`);

// Process each article
for (const article of articles) {
    console.log(`\nProcessing: ${article.title}`);
    console.log(`URL: ${article.link}`);
    
    try {
        // Call Firecrawl API
        const response = await axios.post(
            'https://api.firecrawl.dev/v1/scrape',
            {
                url: article.link,
                formats: ['markdown', 'html'],
                onlyMainContent: true,
                includeTags: ['article', 'main', 'p', 'h1', 'h2', 'h3'],
                waitFor: 5000,
                timeout: 30000
            },
            {
                headers: {
                    'Authorization': `Bearer ${firecrawlApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );
        
        if (response.data && response.data.success) {
            const data = response.data.data;
            
            // Clean markdown content
            const cleanContent = data.markdown
                ?.replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
                ?.replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                ?.replace(/^#+\s/gm, '') // Remove headers
                ?.trim() || data.content || '';
            
            // Save the result
            await Actor.pushData({
                ...article,
                originalUrl: article.link,
                finalUrl: data.metadata?.sourceURL || article.link,
                pageTitle: data.metadata?.title || '',
                metaDescription: data.metadata?.description || '',
                articleContent: cleanContent,
                fullMarkdown: data.markdown,
                contentLength: cleanContent.length,
                scrapedAt: new Date().toISOString(),
                success: true,
                firecrawlMetadata: data.metadata
            });
            
            console.log(`✓ Success! Scraped ${cleanContent.length} characters`);
            
        } else {
            // Firecrawl couldn't scrape it
            const errorMsg = response.data?.error || 'Unknown error';
            console.log(`✗ Firecrawl failed: ${errorMsg}`);
            
            await Actor.pushData({
                ...article,
                originalUrl: article.link,
                error: errorMsg,
                success: false,
                scrapedAt: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error(`✗ Error: ${error.message}`);
        
        // Check if it's a rate limit error
        if (error.response?.status === 429) {
            console.log('Rate limited, waiting 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        await Actor.pushData({
            ...article,
            originalUrl: article.link,
            error: error.response?.data?.error || error.message,
            success: false,
            scrapedAt: new Date().toISOString()
        });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log('\n✓ All articles processed!');

await Actor.exit();

