// Jest setup file for LocalBuy testing
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.TEST_PORT || 3001;
process.env.SESSION_SECRET = 'test-session-secret';

// Mock console methods to reduce noise during testing
global.console = {
    ...console,
    // Uncomment the line below to disable console.log during tests
    // log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Global test timeout
jest.setTimeout(30000);

// Setup and teardown hooks
beforeAll(async () => {
    // Global setup before all tests
});

afterAll(async () => {
    // Global cleanup after all tests
    // Force close any Redis connections
    if (global.redisClient) {
        try {
            await global.redisClient.quit();
        } catch (error) {
            // Redis client might already be closed
        }
    }
    
    // Give time for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
});

beforeEach(() => {
    // Setup before each test
});

afterEach(() => {
    // Cleanup after each test
});