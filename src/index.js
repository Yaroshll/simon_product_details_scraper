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
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-novelty-cuff-poplin-shirt?crpid=8725176156220",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-linen-blend-dress-shirt?crpid=8758496886844",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-novelty-cuff-poplin-shirt-2?crpid=8735827656764",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/spyder-podium-1-2-zip-mock-neck-baselayer-pullover-2?crpid=8730805403708",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Spyder",
          "savings": 80,
          "currentPrice": "$27.99",
          "originalPrice": "$139.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-6?crpid=8817628184636",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/burberry-mens-be4439-51mm-sunglasses-1?crpid=8815734816828",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Burberry",
          "savings": 80,
          "currentPrice": "$99.98",
          "originalPrice": "$493.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-tech-raffi-compact-pant?crpid=7871496585276",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 80,
          "currentPrice": "$55.98",
          "originalPrice": "$285.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-solid-linen-shirt?crpid=8745112895548",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-wright-knit-blazer?crpid=8735790628924",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$199.98",
          "originalPrice": "$995.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-pratt-multi-stripe-crewneck-sweater-1?crpid=8735789285436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$69.98",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-5?crpid=8758937485372",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-linen-shirt?crpid=8745113255996",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-linen-shirt-2?crpid=8745124462652",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-hardy-shirt?crpid=8771950837820",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$49.98",
          "originalPrice": "$245.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-pearce-stretch-knit-shirt?crpid=8725295366204",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-knight-johnny-collar-shirt-1?crpid=8725222424636",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$69.98",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-linen-shirt-1?crpid=8745116893244",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-knight-johnny-collar-shirt-3?crpid=8725308932156",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$69.98",
          "originalPrice": "$350.00",
          "tags": ""
        },
        
        
        
        
      
];

/**
 * Processes a single URL and extracts product data
 *
 * @param {Page} page - Playwright page object
 * @param {Object} urlObj - URL object containing url, tags, brand, typeitem
 * @param {number} index - Current URL index for logging
 * @param {number} total - Total number of URLs
 * @returns {Promise<{success: boolean, data: {productRows: Array<Object>, extraImageRows: Array<Object>}, url: Object}>} Extracted product data
 */
async function processSingleUrl(page, urlObj, index, total) {
  const { url } = urlObj;

  try {
    console.log(`\n🔎 [${index}/${total}] Extracting: ${url}`);

    const startTime = Date.now();
    const { productRows, extraImageRows } = await extractProductData(page, urlObj);
    const endTime = Date.now();

    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Finished: ${url} — Extracted ${productRows.length} product rows and ${extraImageRows.length} extra image rows in ${duration}s`
    );

    return { 
      success: true, 
      data: { productRows, extraImageRows }, 
      url: urlObj 
    };
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
      successful.push(...result.data.productRows);
      // Add extra image rows to successful as well
      if (result.data.extraImageRows.length > 0) {
        successful.push(...result.data.extraImageRows);
      }
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
