@echo off
echo ======================================
echo   LocalBuy Cache System Setup
echo ======================================

echo.
echo 1. Installing missing npm packages...
call npm install --silent

echo.
echo 2. Setting up database schema...
call node scripts/setup-db-schema.js

echo.
echo 3. Testing Redis connection...
call node scripts/test-redis.js

echo.
echo 4. Starting the application...
echo   - Cache system: ENABLED
echo   - Session storage: Redis (fallback to memory)
echo   - Browser caching: Session Storage API
echo.

echo Open your browser to: http://localhost:3000
echo.
echo Available features:
echo   ✓ Shopping cart persistence
echo   ✓ User preferences and themes
echo   ✓ Search history and suggestions
echo   ✓ Recently viewed products
echo   ✓ Form auto-save functionality
echo   ✓ Real-time notifications
echo.

echo To test with caching enabled, visit:
echo   http://localhost:3000/user/dashboard?cached=true
echo.
echo To enable debug mode, add: ?debug=cache
echo   Example: http://localhost:3000?debug=cache
echo.

call npm start