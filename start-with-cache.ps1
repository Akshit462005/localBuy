# LocalBuy Cache System Setup
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   LocalBuy Cache System Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "1. Installing missing npm packages..." -ForegroundColor Yellow
npm install --silent

Write-Host ""
Write-Host "2. Setting up database schema..." -ForegroundColor Yellow
node scripts/setup-db-schema.js

Write-Host ""
Write-Host "3. Testing Redis connection..." -ForegroundColor Yellow
node scripts/test-redis.js

Write-Host ""
Write-Host "4. Starting the application..." -ForegroundColor Yellow
Write-Host "   - Cache system: ENABLED" -ForegroundColor Green
Write-Host "   - Session storage: Redis (fallback to memory)" -ForegroundColor Green
Write-Host "   - Browser caching: Session Storage API" -ForegroundColor Green
Write-Host ""

Write-Host "🌐 Access your application:" -ForegroundColor Magenta
Write-Host "   HTTP:  http://localhost:3000" -ForegroundColor White
Write-Host "   HTTPS: https://localhost:3443 (SSL/TLS enabled)" -ForegroundColor Green
Write-Host ""
Write-Host "Available features:" -ForegroundColor White
Write-Host "   ✓ Shopping cart persistence" -ForegroundColor Green
Write-Host "   ✓ User preferences and themes" -ForegroundColor Green
Write-Host "   ✓ Search history and suggestions" -ForegroundColor Green
Write-Host "   ✓ Recently viewed products" -ForegroundColor Green
Write-Host "   ✓ Form auto-save functionality" -ForegroundColor Green
Write-Host "   ✓ Real-time notifications" -ForegroundColor Green
Write-Host "   ✓ SSL/TLS encryption (HTTPS)" -ForegroundColor Green
Write-Host ""

Write-Host "To test with caching enabled, visit:" -ForegroundColor Yellow
Write-Host "   HTTP:  http://localhost:3000/user/dashboard?cached=true" -ForegroundColor White
Write-Host "   HTTPS: https://localhost:3443/user/dashboard?cached=true" -ForegroundColor Green
Write-Host ""
Write-Host "To enable debug mode, add: ?debug=cache" -ForegroundColor Yellow
Write-Host "   Example: https://localhost:3443?debug=cache" -ForegroundColor White
Write-Host ""

npm start