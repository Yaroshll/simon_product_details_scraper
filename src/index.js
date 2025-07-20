import { launchBrowser } from "./helpers/browser.js";
import { extractProductData } from "./helpers/extractors.js";
import { saveToExcel } from "./helpers/excelWriter.js";

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
];

const allData = [];

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
    console.error(`❌ Error extracting ${urlObj.url}`, err);
  }
}

await browser.close();

if (allData.length > 0) {
  saveToExcel(allData);
} else {
  console.warn("⚠️ No data extracted. Excel file was not created.");
}
