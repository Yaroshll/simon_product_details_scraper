import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

export async function extractProductData(page, urlObj) {
  const { url, tags, brand, typeitem } = urlObj;
  await page.goto(url, { waitUntil: "load", timeout: 700000 });

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

  // Function to extract all images from the page
  async function extractAllImages() {
    try {
      // Wait for image elements to be present
      await page.waitForSelector(".pdp-main-img, .pswp__img, img.product-single__photo", {
        state: "attached",
        timeout: 10000
      });

      // Extract all product images
      const imageUrls = await page.$$eval(
        ".pdp-main-img, .pswp__img, img.product-single__photo", 
        (imgs) => {
          return imgs.map(img => {
            // Try srcset first (usually has higher resolution)
            const srcset = img.getAttribute("srcset");
            if (srcset) {
              const sources = srcset.split(",").map(s => s.trim());
              // Get the highest resolution version (usually last)
              const highestRes = sources[sources.length - 1].split(" ")[0];
              return highestRes.startsWith("//") ? `https:${highestRes}` : highestRes;
            }
            
            // Try data attributes for zoom images
            const dataSrc = img.getAttribute("data-photoswipe-src") || 
                           img.getAttribute("data-zoom");
            if (dataSrc) {
              return dataSrc.startsWith("//") ? `https:${dataSrc}` : dataSrc;
            }
            
            // Fall back to regular src
            const src = img.getAttribute("src");
            return src && src.startsWith("//") ? `https:${src}` : src;
          }).filter(src => src && src.includes("shopify") && !src.includes("placeholder"));
        }
      );

      return [...new Set(imageUrls)]; // Return unique URLs
    } catch (e) {
      console.warn("⚠️ Could not extract images:", e.message);
      return [];
    }
  }

  const colorFieldset = await page.$('fieldset[name="Color"]');
  const variantDetails = [];

  if (colorFieldset) {
    const variantInputs = await colorFieldset.$$(".variant-input");

    for (const inputDiv of variantInputs) {
      const value = await inputDiv.getAttribute("data-value");
      const inputElement = await inputDiv.$('input[type="radio"]');
      const isChecked = await inputElement?.evaluate((el) => el.checked);
      const labelElement = await inputDiv.$("label.variant__button-label");

      if (value && labelElement) {
        const labelFor = await labelElement.getAttribute("for");
        variantDetails.push({
          value,
          isChecked,
          labelLocator: page.locator(
            `label.variant__button-label[for="${labelFor}"]`
          ),
        });
      }
    }
  }

  if (variantDetails.length === 0) {
    console.log("⚠️ No color variants found. Skipping color logic.");
    
    // Extract images for products without color variants
    const imageUrls = await extractAllImages();
    imageUrls.forEach((src) => {
      if (src && !savedImages.has(src)) {
        images.push({ handle, image: src, color: "" });
        savedImages.add(src);
      }
    });
  } else if (variantDetails.length === 1) {
    const color = variantDetails[0].value;
    console.log(`✅ Single color variant: ${color}`);

    const imageUrls = await extractAllImages();
    imageUrls.forEach((src) => {
      if (src && !savedImages.has(src)) {
        images.push({ handle, image: src, color });
        savedImages.add(src);
      }
    });
  } else {
    console.log(`✅ Multiple color variants: ${variantDetails.length}`);
    
    // First, capture the initial/default color images
    for (const variant of variantDetails) {
      const color = variant.value;
      const inputHandle = await page
        .locator(`input[name="Color"][value="${color}"]`)
        .elementHandle();
      const currentlyChecked = await inputHandle?.evaluate((el) => el.checked);

      if (currentlyChecked) {
        console.log(`📸 Capturing initial images for color: ${color}`);
        
        const imageUrls = await extractAllImages();
        imageUrls.forEach((src) => {
          if (src && !savedImages.has(src)) {
            images.push({ handle, image: src, color });
            savedImages.add(src);
            console.log(`✅ Saved image for ${color}: ${src.substring(0, 50)}...`);
          }
        });
        break;
      }
    }

    // NEW APPROACH: Look for color-specific images in the page data
    // Many Shopify stores store all variant images in JavaScript objects
    
    try {
      // Try to extract product JSON data which often contains all variant images
      const productData = await page.evaluate(() => {
        // Look for product data in script tags
        const scripts = document.querySelectorAll('script[type="application/json"]');
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            if (data.product && data.product.variants) {
              return data;
            }
          } catch (e) {
            // Continue to next script
          }
        }
        return null;
      });

      if (productData && productData.product) {
        console.log("📦 Found product data in JSON");
        
        // Map color names to variant IDs
        const colorToVariantId = {};
        for (const variant of productData.product.variants) {
          if (variant.option1 && variant.featured_image) {
            colorToVariantId[variant.option1] = variant.id;
            
            // Check if we have images for this variant
            if (variant.featured_image && variant.featured_image.src) {
              const color = variant.option1;
              const src = variant.featured_image.src.startsWith('//') 
                ? `https:${variant.featured_image.src}` 
                : variant.featured_image.src;
              
              if (src && !savedImages.has(src)) {
                images.push({ handle, image: src, color });
                savedImages.add(src);
                console.log(`✅ Found variant image for ${color}: ${src.substring(0, 50)}...`);
              }
            }
          }
        }

        // Also check for media (images) associated with each variant
        if (productData.product.media) {
          for (const media of productData.product.media) {
            if (media.alt) {
              // Try to extract color from alt text
              for (const variant of variantDetails) {
                const color = variant.value;
                if (media.alt.toLowerCase().includes(color.toLowerCase())) {
                  const src = media.src.startsWith('//') 
                    ? `https:${media.src}` 
                    : media.src;
                  
                  if (src && !savedImages.has(src)) {
                    images.push({ handle, image: src, color });
                    savedImages.add(src);
                    console.log(`✅ Found media image for ${color}: ${src.substring(0, 50)}...`);
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not extract product JSON data:", e.message);
    }

    // If we still don't have images for all colors, try clicking through them
    if (images.filter(img => img.color && img.image).length < variantDetails.length) {
      console.log("🖱️ Trying click-through approach for remaining colors...");
      
      for (const variant of variantDetails) {
        const color = variant.value;
        const labelLocator = variant.labelLocator;
        const inputHandle = await page
          .locator(`input[name="Color"][value="${color}"]`)
          .elementHandle();
        const currentlyChecked = await inputHandle?.evaluate((el) => el.checked);

        // Skip if we already have images for this color or it's the default
        if (currentlyChecked || images.some(img => img.color === color && img.image)) {
          continue;
        }

        try {
          console.log(`🎨 Selecting color: ${color}`);
          
          // Click the color option
          await labelLocator.click({ timeout: 30000 });
          
          // Wait for any network requests to complete
          await page.waitForTimeout(2000);
          
          // Wait for any image changes
          await page.waitForFunction(() => {
            const imgs = document.querySelectorAll('.pdp-main-img, .pswp__img, img.product-single__photo');
            return imgs.length > 0;
          }, { timeout: 10000 });
          
          // Extract images after the click
          const imageUrls = await extractAllImages();
          let foundNewImage = false;
          
          for (const src of imageUrls) {
            if (src && !savedImages.has(src)) {
              images.push({ handle, image: src, color });
              savedImages.add(src);
              foundNewImage = true;
              console.log(`✅ Saved image for ${color}: ${src.substring(0, 50)}...`);
            }
          }
          
          if (!foundNewImage) {
            console.log(`⚠️ No new images found for "${color}"`);
            // Add a placeholder entry to maintain the color variant
            images.push({ handle, image: "", color });
          }
          
        } catch (err) {
          console.warn(`⚠️ Could not select color "${color}":`, err.message);
          // Add a placeholder entry to maintain the color variant
          images.push({ handle, image: "", color });
        }
      }
    }
  }

  // Rest of your code remains the same...
  const colorImageMap = new Map();
  images.forEach((img) => {
    if (!colorImageMap.has(img.color)) {
      colorImageMap.set(img.color, img.image);
    }
  });

  const uniqueColors = [...colorImageMap.keys()];

  const mainRow = {
    Handle: handle,
    Title: title.trim(),
    "Body (HTML)": description.trim(),
    Tags: tags,
    "Option1 Name": option1Name,
    "Option1 Value": option1Value,
    "Option2 Name": "Color",
    "Option2 Value": uniqueColors[0] || "",
    "Variant Price": variantPrice.toFixed(2),
    "Cost per item": cost.toFixed(2),
    "Image Src": colorImageMap.get(uniqueColors[0]) || "",
    "product.metafields.custom.original_prodect_url": url,
    "Variant Fulfillment Service": "manual",
    "Variant Inventory Policy": "deny",
    "Variant Inventory Tracker": "shopify",
    "product.metafields.custom.brand": brand || "",
    "product.metafields.custom.typeitem": typeitem || "",
    Type: "USA Products",
    Vendor: "simon",
    Published: "TRUE",
  };

  const rows = [mainRow];

  if (uniqueColors.length > 1) {
    const colorRows = uniqueColors.slice(1).map((color) => ({
      Handle: handle,
      Title: "",
      "Body (HTML)": "",
      Tags: "",
      "Option1 Name": "",
      "Option1 Value": "",
      "Option2 Name": "Color",
      "Option2 Value": color,
      "Variant Price": variantPrice.toFixed(2),
      "Cost per item": cost.toFixed(2),
      "Image Src": colorImageMap.get(color) || "",
      "product.metafields.custom.original_prodect_url": "",
      "Variant Fulfillment Service": "manual",
      "Variant Inventory Policy": "deny",
      "Variant Inventory Tracker": "shopify",
      "product.metafields.custom.brand": brand || "",
      "product.metafields.custom.typeitem": typeitem || "",
      Type: "USA Products",
      Vendor: "simon",
      Published: "TRUE",
    }));

    rows.push(...colorRows);
  } else {
    const extraImages = images.slice(1).map((img) => ({
      Handle: handle,
      Title: "",
      "Body (HTML)": "",
      Tags: "",
      "Option1 Name": "",
      "Option1 Value": "",
      "Option2 Name": "",
      "Option2 Value": uniqueColors[0] || "",
      "Variant Price": "",
      "Cost per item": "",
      "Image Src": img.image,
      "product.metafields.custom.original_prodect_url": "",
      "Variant Fulfillment Service": "",
      "Variant Inventory Policy": "",
      "Variant Inventory Tracker": "",
      "product.metafields.custom.brand": "",
      "product.metafields.custom.typeitem": "",
      Type: "",
      Vendor: "",
      Published: "",
    }));

    rows.push(...extraImages);
  }

  return rows;
}