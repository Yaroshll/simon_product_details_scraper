import {
  launchBrowser,
  createBrowserContext,
  createPage,
} from "./helpers/browser.js";
import { extractProductData } from "./helpers/extractors.js";
import { saveToCSV } from "./helpers/excelWriter.js";

// Configuration constants
const CONFIG = {
  BATCH_SIZE: 10, // Process URLs in batches
  DELAY_BETWEEN_REQUESTS: 1000, // 1 second delay between requests
};

// Sample product URLs to scrape
const PRODUCT_URLS = [
  {
    url: "https://shop.simon.com/products/black-logo-buckle-county-belt?crpid=7151352938556&cid=adClick:collection",
    status: "accepted",
    reason: "Meets all criteria",
    brand: "Marcelo Burlon",
    savings: 82,
    currentPrice: "$31.00",
    originalPrice: "$175.00",
    tags: "All, Outlet, Men, Accessories, Belts & Buckles, Belts",
    sourceFile: "scrapper_progress_2025-08-19T04-59-45-750Z_start1.json",
    scrapedAt: "2025-08-19T05:02:48.761Z",
  },
  {
    url: "https://shop.simon.com/products/venice-navy-blue-suede-mens-belt?crpid=7327923273788&cid=adClick:collection",
    status: "accepted",
    reason: "Meets all criteria",
    brand: "Vella Pais",
    savings: 53,
    currentPrice: "$32.99",
    originalPrice: "$69.99",
    tags: "All, Outlet, Men, Accessories, Belts & Buckles, Belts",
    sourceFile: "scrapper_progress_2025-08-19T04-59-45-750Z_start1.json",
    scrapedAt: "2025-08-19T05:02:48.761Z",
  },
  {
    url: "https://shop.simon.com/products/ferrara-tan-suede-mens-belt?crpid=7327927271484&cid=adClick:collection",
    status: "accepted",
    reason: "Meets all criteria",
    brand: "Vella Pais",
    savings: 53,
    currentPrice: "$32.99",
    originalPrice: "$69.99",
    tags: "All, Outlet, Men, Accessories, Belts & Buckles, Belts",
    sourceFile: "scrapper_progress_2025-08-19T04-59-45-750Z_start1.json",
    scrapedAt: "2025-08-19T05:02:48.761Z",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-signature-buckle-cut-to-size-reversible-belt-38-mm-1?crpid=7207927644220",
    status: "accepted",
    reason: "Meets all criteria",
    brand: "Coach Outlet",
    savings: 60,
    currentPrice: "$79.00",
    originalPrice: "$198.00",
    tags: "All, Outlet, Men, Accessories, Belts & Buckles, Belts",
    sourceFile: "scrapper_progress_2025-08-19T04-59-45-750Z_start1.json",
    scrapedAt: "2025-08-19T05:02:48.761Z",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-double-bar-buckle-cut-to-size-reversible-belt-38-mm-3?crpid=7868845916220",
    status: "accepted",
    reason: "Meets all criteria",
    brand: "Coach Outlet",
    savings: 60,
    currentPrice: "$79.00",
    originalPrice: "$198.00",
    tags: "All, Outlet, Men, Accessories, Belts & Buckles, Belts",
    sourceFile: "scrapper_progress_2025-08-19T04-59-45-750Z_start1.json",
    scrapedAt: "2025-08-19T05:02:48.761Z",
  },
];

/**
 * Processes a single URL and extracts product data
 *
 * @param {Page} page - Playwright page object
 * @param {Object} urlObj - URL object containing url, tags, brand, typeitem
 * @param {number} index - Current URL index for logging
 * @param {number} total - Total number of URLs
 * @returns {Promise<Array<Object>>} Extracted product data
 */
async function processSingleUrl(page, urlObj, index, total) {
  const { url } = urlObj;

  try {
    console.log(`\n🔎 [${index}/${total}] Extracting: ${url}`);

    const startTime = Date.now();
    const productRows = await extractProductData(page, urlObj);
    const endTime = Date.now();

    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Finished: ${url} — Extracted ${productRows.length} rows in ${duration}s`
    );

    return { success: true, data: productRows, url: urlObj };
  } catch (error) {
    console.error(`❌ Error extracting ${url}:`, error.message);
    return { success: false, error: error.message, url: urlObj };
  }
}


/**
 * Processes URLs in batches to avoid overwhelming the server
 *
 * @param {Page} page - Playwright page object
 * @param {Array<Object>} urls - Array of URL objects
 * @returns {Promise<{successful: Array<Object>, failed: Array<Object>}>} Processing results
 */
async function processUrlsInBatches(page, urls) {
  const successful = [];
  const failed = [];

  console.log(`🚀 Starting extraction of ${urls.length} URLs...`);

  for (let i = 0; i < urls.length; i++) {
    const urlObj = urls[i];
    const result = await processSingleUrl(page, urlObj, i + 1, urls.length);

    if (result.success) {
      successful.push(...result.data);
    } else {
      failed.push(result.url);
    }

    // Add delay between requests to be respectful to the server
    if (i < urls.length - 1) {
      console.log(
        `⏳ Waiting ${CONFIG.DELAY_BETWEEN_REQUESTS}ms before next request...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
      );
    }
  }

  return { successful, failed };
}

/**
 * Main function that orchestrates the scraping process
 */
async function main() {
  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log("🎯 Simon Product Details Scraper");
    console.log("==================================");

    // Validate input
    if (!PRODUCT_URLS || PRODUCT_URLS.length === 0) {
      throw new Error("No URLs provided for scraping");
    }

    // Initialize browser
    browser = await launchBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Process URLs
    const { successful, failed } = await processUrlsInBatches(
      page,
      PRODUCT_URLS
    );

    // Save results
    if (successful.length > 0) {
      saveToCSV(successful, failed);
    } else {
      console.warn("⚠️ No data extracted. CSV file was not created.");
    }

    // Summary
    console.log("\n📊 Extraction Summary:");
    console.log(`✅ Successful: ${successful.length} rows extracted`);
    console.log(`❌ Failed: ${failed.length} URLs failed`);
    console.log(
      `📈 Success rate: ${(
        (successful.length / (successful.length + failed.length)) *
        100
      ).toFixed(1)}%`
    );
  } catch (error) {
    console.error("💥 Fatal error during scraping:", error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (page) {
      try {
        await page.close();
        console.log("📄 Page closed");
      } catch (error) {
        console.warn("⚠️ Failed to close page:", error.message);
      }
    }

    if (context) {
      try {
        await context.close();
        console.log("🌐 Browser context closed");
      } catch (error) {
        console.warn("⚠️ Failed to close browser context:", error.message);
      }
    }

    if (browser) {
      try {
        await browser.close();
        console.log("🚀 Browser closed");
      } catch (error) {
        console.warn("⚠️ Failed to close browser:", error.message);
      }
    }

    console.log("🏁 Scraping process completed");
  }
}

main();

export { main, processSingleUrl, processUrlsInBatches };
