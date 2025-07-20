import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

export async function extractProductData(page, urlObj) {
  const { url, tags } = urlObj;
  await page.goto(url, { waitUntil: "load", timeout: 60000 });

  const handle = formatHandleFromUrl(url);

  const title = await page.textContent("h1.product-single__title");
  const priceText = await page.textContent("span.product__price--compare");
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);

  const option1Label = await page.textContent("label.variant__label");
  const option1Name = option1Label.match(/^\s*(\w+)/)?.[1]?.trim() || ""; // Matches first word like "Size"
  const option1Value = option1Label.match(/\((.*?)\)/)?.[1]?.trim() || "";

  const description = await page.textContent(".pdp-details-txt");

const variantOptions = await page.$$('fieldset[name="Color"] .variant-input');
const images = [];
const savedImages = new Set();

if (variantOptions.length === 1) {
  // Single color variant case
  const color = await variantOptions[0].getAttribute("data-value");
  const srcsets = await page.$$eval('.slick-track img', imgs =>
    imgs.map(img => img.getAttribute("srcset"))
  );
  
  srcsets.forEach(srcset => {
    const src = srcset?.split(",")[0]?.trim().split(" ")[0];
    if (src && !savedImages.has(src)) {
      images.push({ handle, image: src, color });
      savedImages.add(src);
    }
  });
} else if (variantOptions.length > 1) {
  for (let i = 0; i < variantOptions.length; i++) {
    const variant = variantOptions[i];
    const color = await variant.getAttribute("data-value");

    try {
      const label = await variant.$('label.variant__button-label');
      if (label) {
        // Click the color variant
        await label.click();
        
        // 1. Wait for the color variant to actually be selected
        await page.waitForFunction((expectedColor) => {
          const selected = document.querySelector('.variant-input input[type="radio"]:checked');
          return selected && selected.value === expectedColor;
        }, {}, color);
        
        // 2. Wait for the image to be visible (you might need to adjust the selector)
        await page.waitForSelector('.slick-track img', { visible: true, timeout: 5000 });
        
        // 3. Additional short wait to ensure image is loaded
        await page.waitForTimeout(1000);
        
        // Get the main image
        const src = await page.$eval('.slick-track img', img => {
          const srcset = img.getAttribute("srcset");
          return srcset ? srcset.split(",")[0].trim().split(" ")[0] : null;
        });

        if (src && !savedImages.has(src)) {
          images.push({ handle, image: src, color });
          savedImages.add(src);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Could not process color ${color} — skipped. Error: ${err.message}`);
    }
  }
}


  const productRow = {
    Handle: handle,
    Title: title.trim(),
    "Body (HTML)": description.trim(),
    Tags: tags,
    "Option1 Name": option1Name,
    "Option1 Value": option1Value,
    "Option2 Name": "Color",
    "Option2 Value": images[0]?.color || "",
    "Variant SKU": "",
    "Variant Price": variantPrice.toFixed(2),
    "Compare At Price": price.toFixed(2),
    "Cost per item": cost.toFixed(2),
    "Image Src": images[0]?.image || "",
    URL: url,
  };

  const extraImageRows = images.slice(1).map((img) => ({
    Handle: handle,
    "Image Src": img.image,
  }));

  return [productRow, ...extraImageRows];
}
