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

    if (i === 0) {
      const src = await page.$eval('.slick-track img', img =>
        img.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]
      );

      if (src && !savedImages.has(src)) {
        images.push({ handle, image: src, color });
        savedImages.add(src);
      }

    } else {
      const label = await variant.$("label");
      if (label) {
        try {
          await label.click({ timeout: 3000 });
          await page.waitForTimeout(1500);
        } catch (err) {
          console.warn(`⚠️ Could not click color ${color} — skipped.`);
        }
      }

      const src = await page.$eval('.slick-track img', img =>
        img.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]
      );

      if (src && !savedImages.has(src)) {
        images.push({ handle, image: src, color });
        savedImages.add(src);
      }
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
