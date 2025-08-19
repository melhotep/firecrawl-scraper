import { Actor } from 'apify';
import axios from 'axios';

await Actor.init();

// Function to decode Google News URL by following the redirect
async function decodeGoogleNewsUrl(googleUrl) {
    try {
        console.log(`Decoding: ${googleUrl}`);
        
        // Follow the redirect to get the actual URL
        const response = await axios.get(googleUrl, {
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // The final URL after all redirects
        const actualUrl = response.request.res.responseUrl || response.config.url;
        
        console.log(`Decoded to: ${actualUrl}`);
        return actualUrl;
    } catch (error) {
        console.error(`Failed to decode: ${error.message}`);
        return googleUrl; // Return original if decoding fails
    }
}

const input = await Actor.getInput();
const { articlesJson } = input;

// Parse the JSON string
const articles = JSON.parse(articlesJson);

console.log(`Decoding ${articles.length} Google News URLs...`);

const results = [];

for (const article of articles) {
    let actualUrl = article.link;
    
    // Check if it's a Google News URL
    if (article.link.includes('news.google.com/rss/articles/')) {
        actualUrl = await decodeGoogleNewsUrl(article.link);
    }
    
    results.push({
        ...article,
        originalLink: article.link,
        actualLink: actualUrl,
        decodedAt: new Date().toISOString()
    });
}

await Actor.pushData(results);

console.log(`Done! Decoded ${results.length} URLs`);

await Actor.exit();
