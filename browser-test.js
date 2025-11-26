#!/usr/bin/env node

/**
 * Simple Puppeteer script to demonstrate browser testing of LocalBuy
 * Run with: node browser-test.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runBrowserTest() {
  console.log('🚀 Starting LocalBuy Browser Test...\n');
  
  let browser;
  try {
    // Launch browser
    console.log('📱 Launching browser...');
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false', // Set HEADLESS=false to see browser
      slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO) : 500, // Slow down actions
      devtools: process.env.DEVTOOLS === 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('✅ Browser ready!\n');

    // Test 1: Load homepage
    console.log('🏠 Test 1: Loading homepage...');
    const baseURL = 'http://localhost:3000';
    
    const response = await page.goto(baseURL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log(`   📄 Status: ${response.status()}`);
    
    const title = await page.title();
    console.log(`   📋 Title: "${title}"`);
    
    const url = page.url();
    console.log(`   🌐 URL: ${url}`);
    
    // Ensure screenshots directory exists
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    await page.screenshot({ 
      path: path.join(screenshotDir, 'homepage.png'),
      fullPage: true 
    });
    console.log('   📸 Screenshot saved: screenshots/homepage.png');
    
    if (response.status() === 200) {
      console.log('   ✅ Homepage loaded successfully!\n');
    } else {
      console.log('   ❌ Homepage failed to load\n');
      return;
    }

    // Test 2: Check for navigation elements
    console.log('🧭 Test 2: Checking navigation...');
    
    const navElements = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        text: link.textContent.trim(),
        href: link.href
      })).filter(link => link.text && link.href);
    });
    
    console.log(`   🔗 Found ${navElements.length} navigation links:`);
    navElements.slice(0, 5).forEach(link => {
      console.log(`      "${link.text}" → ${link.href}`);
    });
    if (navElements.length > 5) {
      console.log(`      ... and ${navElements.length - 5} more links`);
    }
    
    // Test 3: Look for login functionality
    console.log('\n🔐 Test 3: Looking for authentication...');
    
    const authLinks = navElements.filter(link => 
      link.text.toLowerCase().includes('login') || 
      link.text.toLowerCase().includes('register') ||
      link.text.toLowerCase().includes('sign')
    );
    
    if (authLinks.length > 0) {
      console.log('   ✅ Found authentication links:');
      authLinks.forEach(link => {
        console.log(`      "${link.text}" → ${link.href}`);
      });
      
      // Try to navigate to login page
      const loginLink = authLinks.find(link => 
        link.text.toLowerCase().includes('login')
      );
      
      if (loginLink) {
        console.log(`\n   🔗 Navigating to: ${loginLink.text}`);
        await page.goto(loginLink.href, { waitUntil: 'networkidle2' });
        
        await page.screenshot({ 
          path: path.join(screenshotDir, 'login-page.png'),
          fullPage: true 
        });
        console.log('   📸 Login page screenshot saved');
        
        const loginTitle = await page.title();
        console.log(`   📋 Login page title: "${loginTitle}"`);
        console.log('   ✅ Successfully navigated to login page!');
      }
    } else {
      console.log('   ⚠️ No authentication links found');
    }

    // Test 4: Check page structure
    console.log('\n🏗️ Test 4: Analyzing page structure...');
    
    const pageInfo = await page.evaluate(() => {
      return {
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          tag: h.tagName,
          text: h.textContent.trim()
        })),
        forms: document.querySelectorAll('form').length,
        inputs: document.querySelectorAll('input').length,
        buttons: document.querySelectorAll('button').length,
        images: document.querySelectorAll('img').length
      };
    });
    
    console.log(`   📊 Page contains:`);
    console.log(`      ${pageInfo.headings.length} headings`);
    console.log(`      ${pageInfo.forms} forms`);
    console.log(`      ${pageInfo.inputs} input fields`);
    console.log(`      ${pageInfo.buttons} buttons`);
    console.log(`      ${pageInfo.images} images`);
    
    if (pageInfo.headings.length > 0) {
      console.log(`   📋 Main headings:`);
      pageInfo.headings.slice(0, 3).forEach(h => {
        console.log(`      ${h.tag}: "${h.text}"`);
      });
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📁 Check the screenshots/ folder to see captured images');
    console.log('\n💡 To run with visible browser: HEADLESS=false node browser-test.js');
    console.log('💡 To run slower: SLOWMO=2000 node browser-test.js');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔍 Make sure your LocalBuy server is running on http://localhost:3000');
    console.error('   Run: npm run dev');
  } finally {
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
runBrowserTest().catch(console.error);