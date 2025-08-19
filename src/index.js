import { launchBrowser } from "./helpers/browser.js";
import { extractProductData } from "./helpers/extractors.js";
import { saveToCSV } from "./helpers/excelWriter.js";

const urls = [
  {
    url: "https://shop.simon.com/products/coach-outlet-city-tote-bag-in-signature-canvas?crpid=7913406267452&cid=adClick%3Acollection&variant=42616607637564",
    tags: "",
    brand: "Coach Outlet", 
    typeitem: "Handbag"  
  }
  
];
const allData = [];
const failedUrls = [];

const browser = await launchBrowser();
const context = await browser.newContext();
const page = await context.newPage();

for (const [index, urlObj] of urls.entries()) {
  try {
    console.log(`\n🔎 [${index + 1}/${urls.length}] Extracting: ${urlObj.url}`);
    const productRows = await extractProductData(page, urlObj);
    allData.push(...productRows);
    console.log(`✅ Finished: ${urlObj.url} — Extracted ${productRows.length} rows.`);
  } catch (err) {
    console.error(`❌ Error extracting ${urlObj.url}`, err.message);
    failedUrls.push(urlObj);  // ✅ Save the failed URL with its tag
  }
}

await browser.close();

if (allData.length > 0) {
  saveToCSV(allData, failedUrls);
} else {
  console.warn("⚠️ No data extracted. CSV file was not created.");
}
