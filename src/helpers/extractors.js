import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

export async function extractProductData(page, urlObj) {
  const { url, tags } = urlObj;
  console.log(`🔎 Extracting: ${url}`);
  
  try {
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
    let colorVariantName = "";
    let colorVariantValue = "";

    async function extractMainImageSrc() {
      try {
        await page.waitForSelector(".pdp-main-img", { state: "visible", timeout: 5000 });
        const src = await page.$eval(".pdp-main-img", (img) => 
          img.getAttribute("data-photoswipe-src") || img.src
        );
        return src ? src : null;
      } catch (e) {
        console.warn("⚠️ Could not extract main image source:", e.message);
        return null;
      }
    }

    // Handle color variants
    const colorFieldset = await page.$('fieldset[name="Color"]');
    if (colorFieldset) {
      colorVariantName = "Color";
      const variantInputs = await colorFieldset.$$(".variant-input");
      
      if (variantInputs.length > 1) {
        console.log(`${variantInputs.length} color variants found. Iterating through them.`);
        
        // Get currently selected variant first
        const selectedVariant = await colorFieldset.$('.variant--selected');
        if (selectedVariant) {
          colorVariantValue = await selectedVariant.getAttribute("data-value");
          console.log(`Color "${colorVariantValue}" is currently selected. Extracting image.`);
          const src = await extractMainImageSrc();
          if (src && !savedImages.has(src)) {
            images.push({ handle, image: src, color: colorVariantValue });
            savedImages.add(src);
          }
        }

        // Try other variants
        for (const inputDiv of variantInputs) {
          const value = await inputDiv.getAttribute("data-value");
          const inputId = await inputDiv.$eval('input[type="radio"]', el => el.id);
          
          if (value && inputId && value !== colorVariantValue) {
            const labelLocator = page.locator(`label[for="${inputId}"]`);
            const isSelected = await labelLocator.evaluate(el => 
              el.classList.contains('variant--selected')
            );
            
            if (!isSelected) {
              console.log(`Clicking color "${value}"...`);
              try {
                await labelLocator.click({ timeout: 5000 });
                await page.waitForTimeout(2000); // Short wait for potential update
                
                const src = await extractMainImageSrc();
                if (src && !savedImages.has(src)) {
                  console.log(`✅ Extracted image for "${value}": ${src}`);
                  images.push({ handle, image: src, color: value });
                  savedImages.add(src);
                } else {
                  console.log(`⚠️ Image for "${value}" is duplicate or missing.`);
                }
              } catch (err) {
                console.warn(`⚠️ Could not click color "${value}" - skipped. Error: ${err.message}`);
              }
            }
          }
        }
      } else if (variantInputs.length === 1) {
        colorVariantValue = await variantInputs[0].getAttribute("data-value");
        console.log(`Only one color variant found: ${colorVariantValue}. Extracting all images.`);
        
        const srcs = await page.$$eval(".pdp-main-img", (imgs) => 
          imgs.map((img) => img.getAttribute("data-photoswipe-src") || img.src)
        );
        
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
    } else {
      console.log("No color variants found. Extracting default images.");
      const src = await extractMainImageSrc();
      if (src) {
        images.push({ handle, image: src, color: "" });
      }
    }

    console.log(`Finished image extraction. Total unique images saved: ${images.length}`);

    // Create main row with variant info
    const mainRow = {
      Handle: handle,
      Title: title.trim(),
      "Body (HTML)": description.trim(),
      Tags: tags,
      "Option1 Name": option1Name,
      "Option1 Value": option1Value,
      "Option2 Name": colorVariantName,
      "Option2 Value": colorVariantValue,
      "Variant SKU": "",
      "Variant Price": variantPrice.toFixed(2),
      "Compare At Price": price.toFixed(2),
      "Cost per item": cost.toFixed(2),
      "Image Src": images[0]?.image || "",
      "Product URL": url,
    };

    // Extra image rows without duplicating variant info
    const extraImageRows = images.slice(1).map((img) => ({
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

    const rowCount = 1 + extraImageRows.length;
    console.log(`✅ Finished: ${url} — Extracted ${rowCount} rows.`);
    return [mainRow, ...extraImageRows];
  } catch (e) {
    console.error(`❌ Error extracting ${url}:`, e);
    throw e;
  }
}