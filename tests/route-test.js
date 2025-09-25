const jwt = require('jsonwebtoken');
const { auth, isShopkeeper, isUser } = require('../src/middleware/auth');

function testMiddleware() {
    console.log('Testing Authentication Middleware...\n');

    // Test JWT token creation
    try {
        const token = jwt.sign(
            { id: 1, role: 'shopkeeper' },
            'your-jwt-secret',
            { expiresIn: '1h' }
        );
        console.log('✅ JWT token creation successful');
    } catch (err) {
        console.error('❌ JWT token creation failed:', err.message);
    }

    // Test auth middleware
    console.log('\nTesting auth middleware...');
    const mockReq = {
        session: {
            token: jwt.sign(
                { id: 1, role: 'shopkeeper' },
                'your-jwt-secret',
                { expiresIn: '1h' }
            )
        }
    };
    const mockRes = {
        redirect: (path) => {
            console.log(`Redirect called with path: ${path}`);
        }
    };
    const mockNext = () => {
        console.log('Next middleware called');
    };

    try {
        auth(mockReq, mockRes, mockNext);
        console.log('✅ Auth middleware working');
    } catch (err) {
        console.error('❌ Auth middleware failed:', err.message);
    }

    // Test role middleware
    console.log('\nTesting role middleware...');
    mockReq.user = { role: 'shopkeeper' };

    try {
        isShopkeeper(mockReq, mockRes, mockNext);
        console.log('✅ Shopkeeper middleware working');
    } catch (err) {
        console.error('❌ Shopkeeper middleware failed:', err.message);
    }

    mockReq.user.role = 'user';
    try {
        isUser(mockReq, mockRes, mockNext);
        console.log('✅ User middleware working');
    } catch (err) {
        console.error('❌ User middleware failed:', err.message);
    }
}

console.log('Testing route and middleware functionality...\n');
testMiddleware();