const puppeteer = require('puppeteer');

async function runBrowserTests() {
  console.log('🎭 Starting LocalBuy Browser Tests...\n');
  
  const isDebugMode = process.argv.includes('--debug');
  
  const browser = await puppeteer.launch({
    headless: !isDebugMode,
    slowMo: isDebugMode ? 100 : 0,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors'
    ]
  });
  
  const page = await browser.newPage();
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    // Test 1: HTTP Connection
    console.log('🌐 Testing HTTP connection...');
    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 10000 });
      const title = await page.title();
      console.log(`✅ HTTP connection successful - Title: ${title}`);
      testsPassed++;
    } catch (error) {
      console.log('❌ HTTP connection failed:', error.message);
      testsFailed++;
    }
    
    // Test 2: HTTPS Connection
    console.log('🔒 Testing HTTPS connection...');
    try {
      await page.goto('https://localhost:3443', { waitUntil: 'networkidle2', timeout: 10000 });
      const title = await page.title();
      console.log(`✅ HTTPS connection successful - Title: ${title}`);
      testsPassed++;
    } catch (error) {
      console.log('❌ HTTPS connection failed:', error.message);
      testsFailed++;
    }
    
    // Test 3: Registration Page
    console.log('📝 Testing registration page...');
    try {
      await page.goto('http://localhost:3000/auth/register', { waitUntil: 'networkidle2' });
      await page.waitForSelector('form', { timeout: 5000 });
      const formExists = await page.$('form') !== null;
      if (formExists) {
        console.log('✅ Registration page loaded with form');
        testsPassed++;
      } else {
        throw new Error('Registration form not found');
      }
    } catch (error) {
      console.log('❌ Registration page test failed:', error.message);
      testsFailed++;
    }
    
    // Test 4: Login Page
    console.log('🔑 Testing login page...');
    try {
      await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle2' });
      await page.waitForSelector('form', { timeout: 5000 });
      const formExists = await page.$('form') !== null;
      if (formExists) {
        console.log('✅ Login page loaded with form');
        testsPassed++;
      } else {
        throw new Error('Login form not found');
      }
    } catch (error) {
      console.log('❌ Login page test failed:', error.message);
      testsFailed++;
    }
    
    // Test 5: Performance Testing
    console.log('⚡ Testing page performance...');
    try {
      const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          loadTime: Math.round(navigation.loadEventEnd - navigation.navigationStart),
          domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart),
          responseTime: Math.round(navigation.responseEnd - navigation.requestStart)
        };
      });
      
      console.log(`✅ Performance metrics:`);
      console.log(`   - Load Time: ${performanceMetrics.loadTime}ms`);
      console.log(`   - DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
      console.log(`   - Response Time: ${performanceMetrics.responseTime}ms`);
      
      if (performanceMetrics.loadTime < 5000) {
        testsPassed++;
      } else {
        console.log('⚠️  Page load time exceeds 5 seconds');
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ Performance test failed:', error.message);
      testsFailed++;
    }
    
    // Test 6: Mobile Responsiveness
    console.log('📱 Testing mobile responsiveness...');
    try {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      
      const isMobileViewport = await page.evaluate(() => window.innerWidth === 375);
      if (isMobileViewport) {
        console.log('✅ Mobile viewport test passed');
        testsPassed++;
      } else {
        throw new Error('Mobile viewport not properly set');
      }
    } catch (error) {
      console.log('❌ Mobile responsiveness test failed:', error.message);
      testsFailed++;
    }
    
    // Test 7: Screenshot Capture
    console.log('📸 Capturing screenshots...');
    try {
      // Create screenshots directory if it doesn't exist
      const fs = require('fs');
      if (!fs.existsSync('./screenshots')) {
        fs.mkdirSync('./screenshots');
      }
      
      // Desktop screenshot
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      await page.screenshot({
        path: './screenshots/desktop-homepage.png',
        fullPage: true
      });
      
      // Mobile screenshot
      await page.setViewport({ width: 375, height: 667 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      await page.screenshot({
        path: './screenshots/mobile-homepage.png',
        fullPage: true
      });
      
      console.log('✅ Screenshots captured successfully');
      console.log('   - Desktop: ./screenshots/desktop-homepage.png');
      console.log('   - Mobile: ./screenshots/mobile-homepage.png');
      testsPassed++;
    } catch (error) {
      console.log('❌ Screenshot capture failed:', error.message);
      testsFailed++;
    }
    
  } catch (error) {
    console.error('💥 Critical error during testing:', error);
  } finally {
    await browser.close();
    
    // Test Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
    
    if (testsFailed === 0) {
      console.log('\n🎉 All tests passed! LocalBuy is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the server and try again.');
    }
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error.message);
  process.exit(1);
});

// Check if server is running before starting tests
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  console.log('🔍 Checking if LocalBuy server is running...');
  
  // Note: Using a simple approach since fetch might not be available in Node.js < 18
  // In production, you might want to use a library like axios or node-fetch
  
  try {
    await runBrowserTests();
  } catch (error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      console.log('❌ Server not running. Please start the LocalBuy server first:');
      console.log('   npm run dev');
      console.log('   or');
      console.log('   .\\start-with-cache.ps1');
    } else {
      console.error('❌ Error running browser tests:', error.message);
    }
    process.exit(1);
  }
})();