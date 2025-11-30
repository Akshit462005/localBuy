# LocalBuy - E-commerce Platform

🌟 **A modern local e-commerce platform connecting communities through local businesses**

[![GitHub repo](https://img.shields.io/badge/GitHub-LocalBuy-blue?style=flat&logo=github)](https://github.com/daman04/localBuy)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18+-blue?style=flat&logo=express)](https://expressjs.com/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-red?style=flat&logo=redis)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![HTTPS](https://img.shields.io/badge/HTTPS-SSL%2FTLS-green?style=flat&logo=lock)](https://nodejs.org/)

## 🚀 Live Demo & Access
**HTTP**: http://localhost:3000  
**HTTPS**: https://localhost:3443 (SSL/TLS enabled)  
**Repository**: [LocalBuy Platform](https://github.com/daman04/localBuy)

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v20 or higher)
- **PostgreSQL** (v12 or higher) or **Aiven Cloud PostgreSQL**
- **Redis** (v6 or higher) or **Redis Cloud**
- **SSL Certificates** (auto-generated for development)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/daman04/localBuy.git
cd localBuy
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Generate SSL Certificates (Development)
```bash
node scripts/generate-ssl-cert.js
```
This creates self-signed certificates in the `ssl/` directory for local HTTPS development.

### 4. Set up PostgreSQL
**Option A: Local PostgreSQL**
- Create a PostgreSQL database named `defaultdb`
- Update the PostgreSQL credentials in your `.env` file

**Option B: Aiven Cloud PostgreSQL (Recommended)**
- Already configured with SSL/TLS support
- Uses cloud-hosted PostgreSQL with automatic backups

### 5. Set up Redis

**Option A: Local Redis Installation**

#### On Windows:
1. Download Redis from [Redis Downloads](https://redis.io/download)
2. Install and start Redis server
3. Default Redis runs on `localhost:6379`

#### On macOS:
```bash
brew install redis
brew services start redis
```

#### On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Option B: Redis Cloud (Pre-configured)**
- Already configured with Redis Labs Cloud
- Includes authentication and TLS support
- No local Redis installation required

### 6. Environment Configuration
The `.env` file is already configured with cloud services. Key configurations:

```env
# Server configuration
PORT=3000
HTTPS_PORT=3443
NODE_ENV=development

# PostgreSQL configuration (Aiven Cloud)
POSTGRES_USER=your_aiven_username
POSTGRES_PASSWORD=your_aiven_password
POSTGRES_DB=defaultdb
POSTGRES_HOST=your-project-id.aivencloud.com
POSTGRES_PORT=your_postgres_port

# Redis configuration (Redis Labs Cloud)
REDIS_HOST=your-redis-host.redislabs.com
REDIS_PORT=your_redis_port
REDIS_USERNAME=your_redis_username
REDIS_PASSWORD=your_redis_password
REDIS_TLS=false

# SSL Configuration
SSL_ENABLED=true
SSL_KEY_PATH=./ssl/key.pem
SSL_CERT_PATH=./ssl/cert.pem

# Session configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
```

## ✨ Features

- 🏪 **Dual Role System**: Support for both customers and shopkeepers
- 🔐 **Secure Authentication**: JWT-based login system with Redis session management  
- 🛒 **Shopping Cart**: Full cart functionality with quantity management
- 📦 **Order Management**: Complete order tracking system
- 🎨 **Modern UI**: Responsive design with attractive CSS animations
- ⚡ **Performance**: Redis caching and optimized database queries
- 🧪 **Testing**: Comprehensive Jest test suite
- 📱 **Mobile Responsive**: Works perfectly on all devices
- 🔒 **SSL/TLS Security**: HTTPS support with self-signed certificates for development
- ☁️ **Cloud Integration**: Aiven PostgreSQL and Redis Labs for production-ready database and cache
- 🔄 **Auto SSL Configuration**: Automatic SSL certificate generation and validation
- 🛡️ **Database Encryption**: All database connections use SSL/TLS encryption
- 🚀 **Dual Server**: Runs both HTTP (3000) and HTTPS (3443) servers simultaneously

## 🏃‍♂️ Running the Application

### Quick Start with Cache System
```powershell
# Windows PowerShell
.\start-with-cache.ps1
```

This script will:
- Install missing npm packages
- Set up database schema
- Test Redis connection  
- Start both HTTP and HTTPS servers
- Display all available URLs and features

### Development Mode
```bash
npm run dev
```
Starts both:
- **HTTP Server**: http://localhost:3000
- **HTTPS Server**: https://localhost:3443

### Production Mode
```bash
npm start
```

### SSL Certificate Management
```bash
# Generate new SSL certificates
node scripts/generate-ssl-cert.js

# Verify SSL setup
curl -k https://localhost:3443
```

## Redis Usage in the Application

### Session Management
- Redis is used to store user sessions instead of memory
- Sessions are automatically managed by `connect-redis`
- Session expiry is set to 24 hours

### Caching (Optional)
The application includes a Redis utility (`src/utils/redis.js`) for caching:

```javascript
const redisCache = require('./utils/redis');

// Cache data
await redisCache.set('user:123', userData, 3600); // Cache for 1 hour

// Retrieve cached data
const userData = await redisCache.get('user:123');

// Delete cached data
await redisCache.del('user:123');
```

## Benefits of Using Redis

1. **Session Persistence**: Sessions survive server restarts
2. **Scalability**: Multiple server instances can share sessions
3. **Performance**: Fast in-memory data storage
4. **Caching**: Reduce database queries for frequently accessed data

## 🔧 Troubleshooting

### SSL Certificate Issues
```bash
# Regenerate SSL certificates if missing
node scripts/generate-ssl-cert.js

# Check if SSL files exist
ls ssl/
# Should show: cert.pem, key.pem
```

### Database Connection Issues
- **Error: "no encryption"**: Fixed automatically with SSL configuration
- **IP Access Denied**: Add your IP to Aiven console or use SSL bypass
- **Connection Timeout**: Check internet connection for cloud services

### Redis Connection Issues
- **Local Redis**: Ensure Redis server is running: `redis-cli ping`
- **Cloud Redis**: Verify credentials in `.env` file
- **Authentication**: Check REDIS_USERNAME and REDIS_PASSWORD

### Common Commands
```bash
# Check Redis connection
redis-cli ping

# Test HTTPS connection  
curl -k https://localhost:3443

# View SSL certificate details
openssl x509 -in ssl/cert.pem -text -noout

# Monitor database connections
netstat -ano | findstr ":3000\|:3443\|:26525\|:14530"
```

### Browser SSL Warnings
When accessing `https://localhost:3443`:
1. Click "Advanced" or "More Information"  
2. Click "Proceed to localhost (unsafe)"
3. This is normal for self-signed development certificates

## Testing with Jest & Puppeteer

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm test -- --verbose

# Run browser automation tests
npm run test:browser

# Run Puppeteer tests directly
node browser-test.js

# Run Puppeteer with debug mode (visible browser)
node browser-test.js --debug
```

### Test Structure
- **Unit Tests**: Individual function and module testing
- **Integration Tests**: API endpoint testing with supertest
- **Database Tests**: Database connection and query testing
- **Redis Tests**: Cache functionality testing
- **Browser Tests**: Automated browser testing with Puppeteer
- **E2E Tests**: End-to-end user workflow testing

### Test Files
- `tests/api.test.js` - API endpoint tests
- `tests/database.test.js` - Database connection tests
- `tests/redis.test.js` - Redis cache utility tests
- `tests/setup.js` - Jest configuration and global setup
- `browser-test.js` - Puppeteer browser automation tests
- `tests/e2e/` - End-to-end test directory

## 🎭 Browser Testing with Puppeteer

### Installation
Install Puppeteer for automated browser testing:
```bash
npm install puppeteer --save-dev
```

### Browser Test Features
- **Automated Login/Registration**: Test user authentication flows
- **Cart Operations**: Add/remove products, checkout process
- **HTTPS Testing**: Verify SSL certificate handling
- **Responsive Design**: Test mobile and desktop layouts
- **Performance Monitoring**: Measure page load times
- **Screenshot Capture**: Visual regression testing

### Basic Browser Test Example
```javascript
// browser-test.js
const puppeteer = require('puppeteer');

async function runBrowserTests() {
  const browser = await puppeteer.launch({
    headless: process.argv.includes('--debug') ? false : true,
    slowMo: process.argv.includes('--debug') ? 100 : 0
  });
  
  const page = await browser.newPage();
  
  try {
    // Test HTTP connection
    console.log('Testing HTTP connection...');
    await page.goto('http://localhost:3000');
    console.log('✅ HTTP connection successful');
    
    // Test HTTPS connection
    console.log('Testing HTTPS connection...');
    await page.goto('https://localhost:3443');
    console.log('✅ HTTPS connection successful');
    
    // Test registration
    console.log('Testing user registration...');
    await page.goto('http://localhost:3000/auth/register');
    await page.waitForSelector('form');
    console.log('✅ Registration page loaded');
    
    // Test login page
    console.log('Testing login page...');
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForSelector('form');
    console.log('✅ Login page loaded');
    
  } catch (error) {
    console.error('❌ Browser test failed:', error.message);
  } finally {
    await browser.close();
  }
}

runBrowserTests();
```

### Advanced Testing Features
```javascript
// Performance testing
const performanceMetrics = await page.evaluate(() => {
  const navigation = performance.getEntriesByType('navigation')[0];
  return {
    loadTime: navigation.loadEventEnd - navigation.navigationStart,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart
  };
});

// Mobile responsive testing
await page.setViewport({ width: 375, height: 667 }); // iPhone SE
await page.goto('http://localhost:3000');

// Screenshot testing
await page.screenshot({
  path: 'screenshots/homepage-test.png',
  fullPage: true
});
```

### Writing New Tests
Create test files with `.test.js` or `.spec.js` extension in the `tests/` directory:

```javascript
// Example test file: tests/myfeature.test.js
describe('My Feature', () => {
    test('should do something', () => {
        expect(true).toBe(true);
    });
});
```

### Test Environment Configuration
- Uses `.env.test` for test-specific environment variables
- Runs on a different port (3001) to avoid conflicts
- Uses Redis DB 1 instead of 0 for isolation
- Automatically mocks console output to reduce noise

## 🏭 Production Considerations

### SSL/TLS Security
1. **Development**: Uses self-signed certificates (current setup)
2. **Production**: Replace with CA-signed certificates from Let's Encrypt or commercial CA
3. **SSL Configuration**: Set `rejectUnauthorized: true` for production databases

### Database Security  
1. **Aiven PostgreSQL**: Already includes SSL/TLS and IP whitelisting
2. **Backup Strategy**: Aiven provides automatic backups
3. **Monitoring**: Use Aiven console for performance monitoring

### Redis Security
1. **Authentication**: Redis Labs includes built-in authentication
2. **Encryption**: TLS encryption available in cloud setup
3. **Memory Management**: Monitor Redis memory usage and set appropriate limits

### Server Configuration
1. **Environment Variables**: Use production-safe secrets
2. **SSL Certificates**: Use proper domain certificates
3. **Load Balancing**: Consider nginx for SSL termination
4. **Monitoring**: Implement health checks for both HTTP/HTTPS endpoints

## 📁 Project Structure

```
localBuy/
├── src/
│   ├── app.js              # Main application server (HTTP/HTTPS)
│   ├── middleware/         # Authentication middleware
│   ├── routes/            # API routes (auth, user, shopkeeper) 
│   └── utils/             # Utility functions (Redis cache)
├── views/
│   ├── auth/              # Login & Register pages
│   ├── user/              # User dashboard & cart
│   ├── shopkeeper/        # Shopkeeper dashboard & products
│   └── home.ejs           # Landing page
├── public/
│   ├── css/               # Stylesheets with cache integration
│   ├── js/                # Client-side JavaScript (cart, cache)
│   └── uploads/           # User uploaded files
├── ssl/
│   ├── cert.pem           # SSL certificate (auto-generated)
│   └── key.pem            # Private key (auto-generated)
├── scripts/
│   ├── generate-ssl-cert.js # SSL certificate generator
│   ├── setup-db-schema.js  # Database schema setup
│   └── reset-db.js         # Database reset utility
├── tests/                 # Jest test suites
├── start-with-cache.ps1   # Windows PowerShell startup script
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Quick Start Commands

```powershell
# Complete setup and start (Windows)
.\start-with-cache.ps1

# Generate SSL certificates
node scripts/generate-ssl-cert.js

# Setup database schema
node scripts/setup-db-schema.js

# Start development server
npm run dev

# Access the application
# HTTP:  http://localhost:3000
# HTTPS: https://localhost:3443
```

## 🌐 Available URLs

| Service | HTTP URL | HTTPS URL | Purpose |
|---------|----------|-----------|---------|
| **Main App** | http://localhost:3000 | https://localhost:3443 | Main application |
| **User Dashboard** | http://localhost:3000/user/dashboard | https://localhost:3443/user/dashboard | User interface |
| **Shopkeeper Dashboard** | http://localhost:3000/shopkeeper/dashboard | https://localhost:3443/shopkeeper/dashboard | Shopkeeper interface |
| **Login** | http://localhost:3000/auth/login | https://localhost:3443/auth/login | Authentication |
| **Register** | http://localhost:3000/auth/register | https://localhost:3443/auth/register | User registration |

## 👨‍💻 Authors

**Akshit Verma**
- GitHub: [@Akshit462005](https://github.com/Akshit462005)
- Email: akshitverma462005@gmail.com

**Daman (Repository Owner)**
- GitHub: [@daman04](https://github.com/daman04)
- Repository: [LocalBuy](https://github.com/daman04/localBuy)

## 🙏 Acknowledgments

- **Express.js** for the robust web framework
- **Redis Labs** for cloud Redis hosting and session management
- **Aiven** for cloud PostgreSQL hosting with SSL/TLS
- **Node Forge** for SSL certificate generation
- **Jest** for comprehensive testing framework
- **Nodemon** for development server auto-restart
- **Connect-Redis** for seamless Redis session integration