import { chromium } from "playwright";

// Browser configuration constants
const BROWSER_CONFIG = {
  LAUNCH_OPTIONS: {
    headless: true,
    timeout: 12000,
     channel: "chrome",
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
    ],
  },
  CONTEXT_OPTIONS: {
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

/**
 * Launches a Chromium browser instance with optimized settings
 * 
 * @returns {Promise<Browser>} Playwright browser instance
 * 
 * @example
 * const browser = await launchBrowser();
 * const context = await browser.newContext();
 * const page = await context.newPage();
 */
export async function launchBrowser() {
  try {
    console.log("🚀 Launching Chromium browser...");
    
    const browser = await chromium.launch(BROWSER_CONFIG.LAUNCH_OPTIONS);
    
    console.log("✅ Browser launched successfully");
    return browser;
  } catch (error) {
    console.error("❌ Failed to launch browser:", error.message);
    throw error;
  }
}

/**
 * Creates a new browser context with optimized settings
 * 
 * @param {Browser} browser - Playwright browser instance
 * @returns {Promise<BrowserContext>} Browser context
 * 
 * @example
 * const browser = await launchBrowser();
 * const context = await createBrowserContext(browser);
 */
export async function createBrowserContext(browser) {
  try {
    console.log("🌐 Creating browser context...");
    
    const context = await browser.newContext(BROWSER_CONFIG.CONTEXT_OPTIONS);
    
    console.log("✅ Browser context created successfully");
    return context;
  } catch (error) {
    console.error("❌ Failed to create browser context:", error.message);
    throw error;
  }
}

/**
 * Creates a new page in the browser context
 * 
 * @param {BrowserContext} context - Browser context
 * @returns {Promise<Page>} Browser page
 * 
 * @example
 * const context = await createBrowserContext(browser);
 * const page = await createPage(context);
 */
export async function createPage(context) {
  try {
    console.log("📄 Creating new page...");
    
    const page = await context.newPage();
    
    // Set default timeout for page operations
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    console.log("✅ Page created successfully");
    return page;
  } catch (error) {
    console.error("❌ Failed to create page:", error.message);
    throw error;
  }
}
