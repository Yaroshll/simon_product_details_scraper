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
    url: "https://shop.simon.com/products/coach-outlet-graham-crossbody-bag-in-signature-canvas?crpid=7795878985788&cid=adClick:collection",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-mini-klare-crossbody-bag-3?crpid=7925661499452&cid=adClick:collection",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-mini-jamie-camera-bag-in-signature-canvas-1?crpid=7868850634812&cid=adClick:collection",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-sullivan-crossbody-bag-in-signature-canvas?crpid=7921906647100&cid=adClick:collection",
    tags: "",
  },
  {
    url: "https://shop.simon.com/products/coach-outlet-sullivan-pack-in-signature-canvas-2?crpid=7923621593148&cid=adClick:collection",
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
