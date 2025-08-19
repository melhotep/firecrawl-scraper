import { Actor } from 'apify';
import axios from 'axios';

await Actor.init();

// Function to decode Google News URL
async function decodeGoogleNewsUrl(googleUrl) {
    try {
        console.log(`Decoding: ${googleUrl}`);
        
        // Extract the article ID from the URL
        const match = googleUrl.match(/articles\/(.*?)(\?|$)/);
        if (!match || !match[1]) {
            console.log('Could not extract article ID');
            return googleUrl;
        }
        
        const articleId = match[1];
        console.log(`Article ID: ${articleId}`);
        
        // Method 1: Try using Google News redirect endpoint
        const redirectUrl = `https://news.google.com/articles/${articleId}`;
        
        try {
            // Use a headless browser approach by getting the page content
            const response = await axios.get(redirectUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': 'https://news.google.com/',
                },
                maxRedirects: 0,
                validateStatus: (status) => status === 302 || status === 301
            });
            
            if (response.headers.location) {
                console.log(`Found redirect: ${response.headers.location}`);
                return response.headers.location;
            }
        } catch (redirectError) {
            // If we get a redirect error, check if location header exists
            if (redirectError.response && redirectError.response.headers.location) {
                console.log(`Found redirect in error: ${redirectError.response.headers.location}`);
                return redirectError.response.headers.location;
            }
        }
        
        // Method 2: Try base64 decoding (some Google News IDs are base64)
        try {
            // Remove 'CBMi' prefix if present (common in Google News)
            let cleanId = articleId;
            if (cleanId.startsWith('CBMi')) {
                cleanId = cleanId.substring(4);
            }
            
            // Try to decode as base64
            const decoded = Buffer.from(cleanId, 'base64').toString('utf-8');
            
            // Check if decoded string looks like a URL
            if (decoded.includes('http')) {
                // Extract URL from decoded string
                const urlMatch = decoded.match(/(https?:\/\/[^\s\x00-\x1F]+)/);
                if (urlMatch) {
                    console.log(`Decoded URL from base64: ${urlMatch[1]}`);
                    return urlMatch[1];
                }
            }
        } catch (base64Error) {
            console.log('Base64 decoding failed');
        }
        
        console.log('Could not decode Google News URL');
        return googleUrl;
        
    } catch (error) {
        console.error(`Failed to decode: ${error.message}`);
        return googleUrl;
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
