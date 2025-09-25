const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = '';
let testProductId = '';

async function testEndpoints() {
    try {
        console.log('Starting API endpoint tests...\n');

        // Test home page
        console.log('1. Testing home page...');
        const home = await axios.get(BASE_URL);
        console.log('✅ Home page accessible\n');

        // Test registration
        console.log('2. Testing user registration...');
        const registerData = {
            username: 'testuser' + Date.now(),
            email: `testuser${Date.now()}@test.com`,
            password: 'testpass123',
            role: 'shopkeeper'
        };
        await axios.post(`${BASE_URL}/auth/register`, registerData);
        console.log('✅ Registration successful\n');

        // Test login
        console.log('3. Testing login...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: registerData.email,
            password: registerData.password
        });
        console.log('✅ Login successful\n');

        // Test shopkeeper endpoints
        console.log('4. Testing shopkeeper endpoints...');
        
        // Add product
        const productData = {
            name: 'Test Product',
            description: 'Test Description',
            price: 99.99
        };
        const addProductResponse = await axios.post(
            `${BASE_URL}/shopkeeper/add-product`,
            productData,
            { headers: { Cookie: loginResponse.headers['set-cookie'][0] } }
        );
        console.log('✅ Add product endpoint working\n');

        // Test user endpoints
        console.log('5. Testing user endpoints...');
        const userDashboard = await axios.get(
            `${BASE_URL}/user/dashboard`,
            { headers: { Cookie: loginResponse.headers['set-cookie'][0] } }
        );
        console.log('✅ User dashboard accessible\n');

        // Test cart functionality
        console.log('6. Testing cart functionality...');
        await axios.post(
            `${BASE_URL}/user/add-to-cart`,
            { productId: 1 },
            { headers: { Cookie: loginResponse.headers['set-cookie'][0] } }
        );
        console.log('✅ Add to cart endpoint working');

        const cart = await axios.get(
            `${BASE_URL}/user/cart`,
            { headers: { Cookie: loginResponse.headers['set-cookie'][0] } }
        );
        console.log('✅ Cart page accessible\n');

        console.log('All tests completed successfully! ✅');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
    }
}

// Add axios as a dependency first
console.log('Please run: npm install axios --save-dev');
console.log('Then run this test script\n');

// Run the tests
// testEndpoints();