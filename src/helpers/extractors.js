import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

export async function extractProductData(page, urlObj) {
  const { url, tags,brand , typeitem } = urlObj;
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

async function extractMainImageSrc() {
  try {
    // Prefer PhotoSwipe active image when present
    const hasPswp = await page.$('.pswp__item .pswp__img');
    if (hasPswp) {
      await page.waitForSelector('.pswp__item .pswp__img[src]', {
        state: 'attached',
        timeout: 10000,
      });

      const src = await page.$eval('.pswp__item .pswp__img', img => img.getAttribute('src') || '');
      if (src) {
        return src.startsWith('//') ? `https:${src}` : src;
      }
    }

    // Fallback: any visible main image on the PDP (try srcset last entry first)
    const fallback = await page.$('img[srcset], img[src]');
    if (fallback) {
      const src = await page.evaluate(img => {
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const last = srcset.split(',').pop().trim().split(' ')[0];
          return last;
        }
        return img.getAttribute('data-photoswipe-src') || img.getAttribute('src') || '';
      }, fallback);

      if (src) {
        return src.startsWith('//') ? `https:${src}` : src;
      }
    }

    return null;
  } catch (e) {
    console.warn('⚠️ Could not extract main image source:', e.message);
    return null;
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
  } else if (variantDetails.length === 1) {
    const color = variantDetails[0].value;
    console.log(`✅ Single color variant: ${color}`);

    const mainImages = await page.$$eval(".pdp-main-img", (imgs) =>
      imgs.map(
        (img) =>
          img.getAttribute("data-photoswipe-src") || img.getAttribute("src")
      )
    );

    mainImages.forEach((src) => {
      if (src && !savedImages.has(src)) {
        images.push({ handle, image: src, color });
        savedImages.add(src);
      }
    });
  } else {
    console.log(`✅ Multiple color variants: ${variantDetails.length}`);
    const sortedVariants = variantDetails.sort(
      (a, b) => (b.isChecked ? 1 : 0) - (a.isChecked ? 1 : 0)
    );

   for (const variant of sortedVariants) {
  const color = variant.value;
  const labelLocator = variant.labelLocator;
  const inputHandle = await page
    .locator(`input[name="Color"][value="${color}"]`)
    .elementHandle();
  const currentlyChecked = await inputHandle?.evaluate(el => el.checked);

  const prevSrc = await extractMainImageSrc();

  if (currentlyChecked) {
    const src = prevSrc;
    if (src && !savedImages.has(src)) {
      images.push({ handle, image: src, color });
      savedImages.add(src);
    }
  } else {
    try {
      console.log(`🎨 Selecting color: ${color}`);
      await labelLocator.click({ timeout: 50000 });

      // Wait until the displayed image changes
      await waitForMainImageChange(prevSrc, 20000);

      const src = await extractMainImageSrc();
      if (src && !savedImages.has(src)) {
        images.push({ handle, image: src, color });
        savedImages.add(src);
      } else {
        const fallbackImage = [...savedImages][0] || '';
        images.push({ handle, image: fallbackImage, color });
        console.log(`⚠️ No new image found for "${color}", saving fallback image.`);
      }
    } catch (err) {
      console.warn(`⚠️ Could not select color "${color}":`, err.message);
    }
  }
}

  }

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
    //"Compare At Price": price.toFixed(2),
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
      "Option2 Name": " ",
      "Option2 Value": color,
      "Variant Price": "",
      "Cost per item": "",
      "Image Src": colorImageMap.get(color) || "",
      "product.metafields.custom.original_prodect_url": "",
      "Variant Fulfillment Service": "",
      "Variant Inventory Policy": "",
      "Variant Inventory Tracker": "",
      "product.metafields.custom.brand": brand || "",
  "product.metafields.custom.typeitem": typeitem || "",
      Type: "",
      Vendor: "",
      Published: "",
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
      "product.metafields.custom.brand":"",
  "product.metafields.custom.typeitem":  "",
      Type: "",
      Vendor: "",
      Published: "",
    }));

    rows.push(...extraImages);
  }

  return rows;
}
async function waitForMainImageChange(prevSrc, timeoutMs = 15000) {
  try {
    await page.waitForFunction(
      prev => {
        const el = document.querySelector('.pswp__item .pswp__img') ||
                   document.querySelector('img[srcset], img[src]');
        if (!el) return false;
        let current = el.getAttribute('src') || '';
        if (!current && el.getAttribute('srcset')) {
          current = el.getAttribute('srcset').split(',').pop().trim().split(' ')[0];
        }
        if (current.startsWith('//')) current = 'https:' + current;
        return current && current !== prev;
      },
      { timeout: timeoutMs },
      prevSrc || ''
    );
  } catch (_) {
    // swallow – if it times out we’ll handle fallback below
  }
}
