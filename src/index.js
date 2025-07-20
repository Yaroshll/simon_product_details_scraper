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

for (const urlObj of urls) {
  try {
    const productRows = await extractProductData(page, urlObj);
    allData.push(...productRows);
  } catch (err) {
    console.error(`❌ Error on ${urlObj.url}`, err);
  }
}

await browser.close();

saveToExcel(allData);
