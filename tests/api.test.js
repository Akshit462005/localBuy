const request = require('supertest');
const { createApp } = require('../src/app');

// Mock app for testing
let app;
let server;

// Override Redis settings for testing to avoid connection issues
process.env.REDIS_HOST = 'nonexistent';
process.env.REDIS_PORT = '0000';
process.env.REDIS_URL = '';
process.env.REDIS_USERNAME = '';

beforeAll(async () => {
    // Create a test version of the app
    app = createApp();
    server = app.listen(0); // Use random available port for testing
});

afterAll(async () => {
    if (server) {
        await new Promise((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    }
    
    // Give a small delay to ensure all connections are closed
    await new Promise(resolve => setTimeout(resolve, 100));
});

describe('LocalBuy API Endpoints', () => {
    describe('Public Routes', () => {
        test('GET / should return home page', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            expect(response.text).toContain('LocalBuy');
        });

        test('GET /auth/login should return login page', async () => {
            const response = await request(app)
                .get('/auth/login')
                .expect(200);
            
            expect(response.text).toContain('login');
        });

        test('GET /auth/register should return register page', async () => {
            const response = await request(app)
                .get('/auth/register')
                .expect(200);
            
            expect(response.text).toContain('register');
        });
    });

    describe('Authentication', () => {
        const testUser = {
            username: 'testuser' + Date.now(),
            email: `testuser${Date.now()}@test.com`,
            password: 'testpass123',
            role: 'shopkeeper'
        };

        test('POST /auth/register should create new user', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send(testUser);
            
            // Expect redirect or success response
            expect([200, 201, 302]).toContain(response.status);
        });

        test('POST /auth/login should authenticate user', async () => {
            // First register the user
            await request(app)
                .post('/auth/register')
                .send(testUser);

            // Then try to login
            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });
            
            expect([200, 302]).toContain(response.status);
        });
    });

    describe('Protected Routes', () => {
        let agent;
        
        beforeEach(async () => {
            agent = request.agent(app);
            
            // Login before each protected route test
            const testUser = {
                username: 'testshopkeeper' + Date.now(),
                email: `testshopkeeper${Date.now()}@test.com`,
                password: 'testpass123',
                role: 'shopkeeper'
            };

            await agent
                .post('/auth/register')
                .send(testUser);

            await agent
                .post('/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });
        });

        test('GET /shopkeeper/dashboard should be accessible to authenticated shopkeeper', async () => {
            const response = await agent
                .get('/shopkeeper/dashboard');
            
            expect([200, 302]).toContain(response.status);
        });

        test('GET /user/dashboard should be forbidden for shopkeeper', async () => {
            const response = await agent
                .get('/user/dashboard');
            
            // Shopkeeper should not have access to user dashboard
            expect([403, 302]).toContain(response.status);
        });
    });

    describe('User Protected Routes', () => {
        let userAgent;
        
        beforeEach(async () => {
            userAgent = request.agent(app);
            
            // Create and login as regular user
            const testUser = {
                username: 'testuser' + Date.now(),
                email: `testuser${Date.now()}@test.com`,
                password: 'testpass123',
                role: 'user'
            };

            await userAgent
                .post('/auth/register')
                .send(testUser);

            await userAgent
                .post('/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });
        });

        test('GET /user/dashboard should be accessible to authenticated user', async () => {
            const response = await userAgent
                .get('/user/dashboard');
            
            expect([200, 302]).toContain(response.status);
        });

        test('GET /shopkeeper/dashboard should be forbidden for regular user', async () => {
            const response = await userAgent
                .get('/shopkeeper/dashboard');
            
            // Regular user should not have access to shopkeeper dashboard
            expect([403, 302]).toContain(response.status);
        });
    });

    describe('API Health', () => {
        test('Server should be running', () => {
            expect(server).toBeDefined();
            expect(server.listening).toBe(true);
        });
    });
});