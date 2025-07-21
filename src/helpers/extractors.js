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
  const option1Name = option1Label.match(/^\s*(\w+)/)?.[1]?.trim() || "";
  const option1Value = option1Label.match(/\((.*?)\)/)?.[1]?.trim() || "";
  const description = await page.textContent(".pdp-details-txt");

  const images = [];
  const savedImages = new Set();

  async function extractMainImageSrc() {
    try {
      await page.waitForSelector(".pdp-main-img", {
        state: "visible",
        timeout: 5000,
      });
      const src = await page.$eval(".pdp-main-img", (img) => 
        img.getAttribute("data-photoswipe-src")
      );
      return src ? src : null;
    } catch (e) {
      console.warn("⚠️ Could not extract main image:", e.message);
      return null;
    }
  }

  // Handle color variants
  const colorFieldset = await page.$('fieldset[name="Color"]');
  let colorVariantName = "";
  let colorVariantValue = "";

  if (colorFieldset) {
    const variantInputs = await colorFieldset.$$(".variant-input");
    if (variantInputs.length > 1) {
      // Multiple variants - extract main image for each
      colorVariantName = "Color";
      
      for (const inputDiv of variantInputs) {
        const value = await inputDiv.getAttribute("data-value");
        const inputId = await inputDiv.$eval('input[type="radio"]', el => el.id);
        
        if (value && inputId) {
          const labelLocator = page.locator(`label[for="${inputId}"]`);
          const isSelected = await labelLocator.evaluate(el => 
            el.classList.contains('variant--selected')
          );
          
          if (!isSelected) {
            await labelLocator.click();
            await page.waitForLoadState('networkidle', { timeout: 5000 });
          }
          
          const src = await extractMainImageSrc();
          if (src && !savedImages.has(src)) {
            images.push({ handle, image: src, color: value });
            savedImages.add(src);
            // Only set variant value for first image
            if (images.length === 1) {
              colorVariantValue = value;
            }
          }
        }
      }
    } else if (variantInputs.length === 1) {
      // Single variant - extract all images but only set Option2 in first row
      const value = await variantInputs[0].getAttribute("data-value");
      colorVariantName = "Color";
      colorVariantValue = value;
      
      const srcs = await page.$$eval(".pdp-main-img", (imgs) => 
        imgs.map((img) => img.getAttribute("data-photoswipe-src"))
      );
      
      srcs.forEach((src, index) => {
        if (src && !savedImages.has(src)) {
          images.push({ 
            handle, 
            image: src, 
            color: index === 0 ? value : "" // Only set color for first image
          });
          savedImages.add(src);
        }
      });
    }
  }

  // If no variants found, just get main image
  if (images.length === 0) {
    const src = await extractMainImageSrc();
    if (src) {
      images.push({ handle, image: src, color: "" });
    }
  }

  // Create main row
  const mainRow = {
    Handle: handle,
    Title: title.trim(),
    "Body (HTML)": description.trim(),
    Tags: tags,
    "Option1 Name": option1Name,
    "Option1 Value": option1Value,
    "Option2 Name": colorVariantName, // Will be empty if no variants
    "Option2 Value": colorVariantValue, // Will be empty if no variants
    "Variant SKU": "",
    "Variant Price": variantPrice.toFixed(2),
    "Compare At Price": price.toFixed(2),
    "Cost per item": cost.toFixed(2),
    "Image Src": images[0]?.image || "",
    "Product URL": url,
  };

  // Create extra image rows (without duplicating Option2 info)
  const extraImageRows = images.slice(1).map((img) => ({
    Handle: handle,
    Title: "",
    "Body (HTML)": "",
    Tags: "",
    "Option1 Name": "",
    "Option1 Value": "",
    "Option2 Name": "", // Empty for extra rows
    "Option2 Value": "", // Empty for extra rows
    "Variant SKU": "",
    "Variant Price": "",
    "Compare At Price": "",
    "Cost per item": "",
    "Image Src": img.image,
    "Product URL": "",
  }));

  return [mainRow, ...extraImageRows];
}