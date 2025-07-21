import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

export async function extractProductData(page, urlObj) {
  const { url, tags } = urlObj;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const handle = formatHandleFromUrl(url);
    const title = await page.textContent("h1.product-single__title").catch(() => '');
    const priceText = await page.textContent("span.product__price--compare").catch(() => '');
    const price = extractPrice(priceText);
    const { cost, variantPrice } = calculatePrices(price);

    // Extract product details with proper error handling
    const [option1Label, description] = await Promise.all([
      page.textContent("label.variant__label").catch(() => ''),
      page.textContent(".pdp-details-txt").catch(() => '')
    ]);

    const option1Name = option1Label.match(/^\s*(\w+)/)?.[1]?.trim() || "";
    const option1Value = option1Label.match(/\((.*?)\)/)?.[1]?.trim() || "";

    const images = [];
    const savedImages = new Set();

    async function extractMainImageSrc() {
      try {
        await page.waitForSelector(".pdp-main-img", { state: 'attached', timeout: 10000 });
        const src = await page.$eval(".pdp-main-img", img => 
          img.getAttribute("data-photoswipe-src") || img.src
        );
        return src ? src : null;
      } catch (e) {
        console.warn(`⚠️ Could not extract main image for ${url}:`, e.message);
        return null;
      }
    }

    // Handle color variants with more resilient approach
    let colorVariantName = "";
    let colorVariantValue = "";
    let hasMultipleVariants = false;

    try {
      const colorFieldset = await page.$('fieldset[name="Color"]', { timeout: 5000 });
      if (colorFieldset) {
        colorVariantName = "Color";
        const variantInputs = await colorFieldset.$$(".variant-input", { timeout: 5000 });
        
        if (variantInputs.length > 1) {
          hasMultipleVariants = true;
          // For multiple variants, just get the currently selected one
          const selectedVariant = await colorFieldset.$('.variant--selected');
          if (selectedVariant) {
            colorVariantValue = await selectedVariant.getAttribute("data-value").catch(() => '');
            const src = await extractMainImageSrc();
            if (src) {
              images.push({ handle, image: src, color: colorVariantValue });
            }
          }
        } else if (variantInputs.length === 1) {
          // Single variant - get all images but only set Option2 in first row
          colorVariantValue = await variantInputs[0].getAttribute("data-value").catch(() => '');
          const srcs = await page.$$eval(".pdp-main-img", imgs => 
            imgs.map(img => img.getAttribute("data-photoswipe-src") || img.src)
          ).catch(() => []);
          
          srcs.forEach((src, index) => {
            if (src && !savedImages.has(src)) {
              images.push({ 
                handle, 
                image: src, 
                color: index === 0 ? colorVariantValue : "" 
              });
              savedImages.add(src);
            }
          });
        }
      }
    } catch (e) {
      console.warn(`⚠️ Variant extraction error for ${url}:`, e.message);
    }

    // Fallback if no images found
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
      "Option2 Name": hasMultipleVariants ? colorVariantName : "",
      "Option2 Value": hasMultipleVariants ? colorVariantValue : images[0]?.color || "",
      "Variant SKU": "",
      "Variant Price": variantPrice.toFixed(2),
      "Compare At Price": price.toFixed(2),
      "Cost per item": cost.toFixed(2),
      "Image Src": images[0]?.image || "",
      "Product URL": url,
    };

    // Create extra image rows
    const extraImageRows = images.slice(1).map(img => ({
      Handle: handle,
      Title: "",
      "Body (HTML)": "",
      Tags: "",
      "Option1 Name": "",
      "Option1 Value": "",
      "Option2 Name": "",
      "Option2 Value": "",
      "Variant SKU": "",
      "Variant Price": "",
      "Compare At Price": "",
      "Cost per item": "",
      "Image Src": img.image,
      "Product URL": "",
    }));

    return [mainRow, ...extraImageRows];
  } catch (e) {
    console.error(`❌ Critical error extracting ${url}:`, e);
    throw e; // Re-throw to handle in calling function
  }
}