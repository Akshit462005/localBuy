# LocalBuy - E-commerce Platform

🌟 **A modern local e-commerce platform connecting communities through local businesses**

[![GitHub repo](https://img.shields.io/badge/GitHub-LocalBuy-blue?style=flat&logo=github)](https://github.com/Akshit462005/LocalBuy)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18+-blue?style=flat&logo=express)](https://expressjs.com/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-red?style=flat&logo=redis)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue?style=flat&logo=postgresql)](https://www.postgresql.org/)

## 🚀 Live Demo
Visit the live application: [LocalBuy Platform](https://github.com/Akshit462005/LocalBuy)

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher)
- **PostgreSQL** (v12 or higher)
- **Redis** (v6 or higher)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Akshit462005/LocalBuy.git
cd LocalBuy
```

### 2. Install Dependencies
```bash
npm install
```

### 2. Set up PostgreSQL
- Create a PostgreSQL database named `localbuy_db`
- Update the PostgreSQL credentials in your `.env` file

### 3. Set up Redis

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

### 4. Environment Configuration
1. Copy `.env.sample` to `.env`
2. Update the environment variables:

```env
# Server configuration
PORT=3000
NODE_ENV=development

# PostgreSQL configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=localbuy_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_if_any
REDIS_DB=0

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

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
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

## Troubleshooting

### Redis Connection Issues
- Ensure Redis server is running: `redis-cli ping` (should return `PONG`)
- Check Redis logs: `redis-cli logs`
- Verify Redis configuration in `.env` file

### Common Redis Commands
```bash
# Check if Redis is running
redis-cli ping

# Monitor Redis operations
redis-cli monitor

# View all keys
redis-cli --scan

# Clear all data
redis-cli flushall
```

## Testing with Jest

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
```

### Test Structure
- **Unit Tests**: Individual function and module testing
- **Integration Tests**: API endpoint testing with supertest
- **Database Tests**: Database connection and query testing
- **Redis Tests**: Cache functionality testing

### Test Files
- `tests/api.test.js` - API endpoint tests
- `tests/database.test.js` - Database connection tests
- `tests/redis.test.js` - Redis cache utility tests
- `tests/setup.js` - Jest configuration and global setup

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

## Production Considerations

1. **Security**: Set a strong Redis password
2. **Persistence**: Configure Redis persistence (RDB/AOF)
3. **Memory**: Monitor Redis memory usage
4. **SSL**: Use Redis SSL/TLS in production
5. **Clustering**: Consider Redis Cluster for high availability

## 📁 Project Structure

```
LocalBuy/
├── src/
│   ├── app.js              # Main application server
│   ├── middleware/         # Authentication middleware
│   ├── routes/            # API routes (auth, user, shopkeeper)
│   └── utils/             # Utility functions (Redis cache)
├── views/
│   ├── auth/              # Login & Register pages
│   ├── user/              # User dashboard & cart
│   ├── shopkeeper/        # Shopkeeper dashboard & products
│   └── home.ejs           # Landing page
├── public/
│   ├── css/               # Stylesheets
│   ├── images/            # Static images
│   └── uploads/           # User uploaded files
├── tests/                 # Jest test suites
├── scripts/               # Database utilities
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

## 👨‍💻 Author

**Akshit Verma**
- GitHub: [@Akshit462005](https://github.com/Akshit462005)
- Email: akshitverma462005@gmail.com

## 🙏 Acknowledgments

- Express.js for the robust web framework
- Redis for excellent session management
- PostgreSQL for reliable data storage
- Jest for comprehensive testing
- Pexels for beautiful stock images

//# Check Redis status
& "C:\Program Files\Redis\redis-cli.exe" ping

# Monitor Redis operations
& "C:\Program Files\Redis\redis-cli.exe" monitor

# View session keys
& "C:\Program Files\Redis\redis-cli.exe" --scan --pattern "localbuy:*"