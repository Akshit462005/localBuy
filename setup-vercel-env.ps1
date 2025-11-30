# Vercel Environment Variables Setup Script
# Run this after your initial deployment to set up environment variables

Write-Host "Setting up Vercel environment variables..." -ForegroundColor Green

# Set production environment variables
vercel env add NODE_ENV production production
vercel env add SESSION_SECRET "your-super-secret-session-key-change-this-in-production" production
vercel env add POSTGRES_USER "avnadmin" production
vercel env add POSTGRES_PASSWORD "AVNS_BJVs3VAHvvQg-GSdCtq" production
vercel env add POSTGRES_DB "defaultdb" production
vercel env add POSTGRES_HOST "pg-2578dce5-akshitverma462005-8c43.g.aivencloud.com" production
vercel env add POSTGRES_PORT "26525" production
vercel env add REDIS_USERNAME "default" production
vercel env add REDIS_PASSWORD "EnIyoEmsEtQWAQP2FPq5kJCZlIOS0weY" production
vercel env add REDIS_HOST "redis-14530.c258.us-east-1-4.ec2.cloud.redislabs.com" production
vercel env add REDIS_PORT "14530" production
vercel env add REDIS_TLS "false" production

Write-Host "Environment variables setup complete!" -ForegroundColor Green
Write-Host "Now run: vercel --prod" -ForegroundColor Yellow