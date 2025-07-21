import { launchBrowser } from "./helpers/browser.js";
import { extractProductData } from "./helpers/extractors.js";
import { saveToCSV } from "./helpers/excelWriter.js";

const urls = [
  {
    url: "https://shop.simon.com/products/coach-outlet-carmen-mini-crossbody-bag-1",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-hailey-flap-bag-in-sketch-signature-canvas",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-mini-rowan-crossbody-bag-with-charms?crpid=8585358704700",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-warner-crossbody-bag-1?crpid=8585878011964",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-owen-backpack-in-signature-canvas-1?crpid=8585320693820",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-jude-bag-in-signature-canvas?crpid=8278100148284",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-smith-tote-bag-27?crpid=8278028550204",
    tags: "",
  },
  {
    url: "https://shop.simon.com/",
    tags: "",
  },
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
