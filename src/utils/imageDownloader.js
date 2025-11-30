const https = require('https');
const http = require('http');
const { URL } = require('url');

// Function to convert Google Drive share links to direct download links
const convertGoogleDriveLink = (url) => {
    try {
        // Handle different Google Drive URL formats
        let fileId = null;
        
        // Format 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
        let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            fileId = match[1];
        }
        
        // Format 2: https://drive.google.com/open?id=FILE_ID
        if (!fileId) {
            match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
            if (match) {
                fileId = match[1];
            }
        }
        
        if (fileId) {
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
    } catch (error) {
        console.log('Error converting Google Drive link:', error.message);
    }
    
    return url; // Return original URL if not a Drive link or conversion failed
};

// This file now handles URL validation and conversion for direct image loading

// Function to validate if image URL is accessible (optional check)
const checkImageUrl = async (imageUrl) => {
    return new Promise((resolve) => {
        try {
            const processedUrl = convertGoogleDriveLink(imageUrl);
            const client = processedUrl.startsWith('https') ? https : http;
            
            const request = client.get(processedUrl, {
                method: 'HEAD', // Only check headers, don't download
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 5000 // 5 second timeout
            }, (response) => {
                const isValid = response.statusCode === 200 && 
                               (response.headers['content-type'] || '').startsWith('image/');
                resolve({ valid: isValid, statusCode: response.statusCode });
            });
            
            request.on('timeout', () => {
                request.destroy();
                resolve({ valid: false, error: 'Timeout' });
            });
            
            request.on('error', () => {
                resolve({ valid: false, error: 'Network error' });
            });
            
        } catch (error) {
            resolve({ valid: false, error: 'Invalid URL' });
        }
    });
};

// Function to validate image URL
const validateImageUrl = (url) => {
    try {
        const parsedUrl = new URL(url);
        
        // Check if it's HTTP/HTTPS
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
        }
        
        // Check for common image hosting domains or file extensions
        const hostname = parsedUrl.hostname.toLowerCase();
        const pathname = parsedUrl.pathname.toLowerCase();
        
        const validDomains = [
            'images.pexels.com',
            'pixabay.com',
            'unsplash.com',
            'drive.google.com',
            'imgur.com',
            'i.imgur.com'
        ];
        
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        const isDomainValid = validDomains.some(domain => hostname.includes(domain));
        const hasValidExtension = validExtensions.some(ext => pathname.includes(ext));
        
        if (!isDomainValid && !hasValidExtension) {
            return { 
                valid: false, 
                error: 'URL should be from a known image host (Pexels, Pixabay, Unsplash, Google Drive, Imgur) or have a valid image extension' 
            };
        }
        
        return { valid: true };
        
    } catch (error) {
        return { valid: false, error: 'Invalid URL format' };
    }
};

module.exports = {
    validateImageUrl,
    convertGoogleDriveLink,
    checkImageUrl
};