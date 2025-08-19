import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

/**
 * Helper: normalize protocol-relative URLs
 */
function toAbsoluteUrl(src) {
  if (!src) return "";
  if (src.startsWith("//")) return `https:${src}`;
  return src;
}

/**
 * Open PhotoSwipe zoom modal and return the best (non-placeholder) image src.
 * - Clicks the zoom button
 * - Waits for .pswp__img to render
 * - Prefers the visible image without the placeholder class
 * - Closes the modal (ESC)
 */
async function openZoomAndGetHiResSrc(page) {
  try {
    // Ensure zoom button exists & is interactable
    const zoomBtn = page.locator('button.js-photoswipe__zoom');
    await zoomBtn.waitFor({ state: "visible", timeout: 10000 });
    await zoomBtn.click();

    // Wait for the PhotoSwipe modal image(s)
    await page.waitForSelector(".pswp__img", { state: "visible", timeout: 10000 });

    // Collect candidate images from the modal
    const candidateSrcs = await page.$$eval(".pswp__img", (imgs) => {
      // Prefer the one that is actually displayed and not a placeholder
      const visible = imgs.find(
        (img) =>
          getComputedStyle(img).display !== "none" &&
          !img.className.includes("pswp__img--placeholder") &&
          img.getAttribute("src")
      );
      if (visible && visible.getAttribute("src")) return [visible.getAttribute("src")];

      // Fallback: first non-placeholder with src
      const nonPlaceholder = imgs.find(
        (img) =>
          !img.className.includes("pswp__img--placeholder") &&
          img.getAttribute("src")
      );
      if (nonPlaceholder && nonPlaceholder.getAttribute("src")) return [nonPlaceholder.getAttribute("src")];

      // Last fallback: any img with src
      const any = imgs.find((img) => img.getAttribute("src"));
      return any ? [any.getAttribute("src")] : [];
    });

    // Close the modal (ESC)
    await page.keyboard.press("Escape");

    return toAbsoluteUrl(candidateSrcs[0] || "");
  } catch (err) {
    // Try to close modal if it somehow stayed open
    try { await page.keyboard.press("Escape"); } catch (_) {}
    return "";
  }
}

export async function extractProductData(page, urlObj) {
  const { url, tags, brand, typeitem } = urlObj;
  await page.goto(url, { waitUntil: "load", timeout: 700000 });

  const handle = formatHandleFromUrl(url);
  const title = (await page.textContent("h1.product-single__title"))?.trim() || "";
  const priceText = await page.textContent("span.product__price--compare");
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);

  const option1Label = await page.textContent("label.variant__label");
  const option1Name = option1Label?.match(/^\s*(\w+)/)?.[1]?.trim() || "";
  const option1Value = option1Label?.match(/\((.*?)\)/)?.[1]?.trim() || "";

  const description = (await page.textContent(".pdp-details-txt"))?.trim() || "";

  const images = [];
  const savedImages = new Set();

  /**
   * UPDATED: Extract main image via PhotoSwipe zoom first, fallback to .pdp-main-img
   */
  async function extractMainImageSrc() {
    // 1) Preferred: open zoom and read hi-res src from .pswp__img
    const zoomSrc = await openZoomAndGetHiResSrc(page);
    if (zoomSrc) return zoomSrc;

    // 2) Fallback: read from the inline main image if present
    try {
      await page.waitForSelector(".pdp-main-img", {
        state: "visible",
        timeout: 5000,
      });

      const inlineSrc = await page.$eval(".pdp-main-img", (img) => {
        const srcset = img.getAttribute("srcset");
        if (srcset) {
          const parts = srcset.split(",");
          const lastEntry = parts[parts.length - 1].trim().split(" ")[0];
          return lastEntry || "";
        }
        return (
          img.getAttribute("data-photoswipe-src") ||
          img.getAttribute("src") ||
          ""
        );
      });
      return toAbsoluteUrl(inlineSrc);
    } catch (e) {
      console.warn("⚠️ Could not extract main image source:", e.message);
      return "";
    }
  }

  // Build list of color options
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

    // Still try to grab at least one image from zoom
    const src = await extractMainImageSrc();
    if (src) {
      images.push({ handle, image: src, color: "" });
      savedImages.add(src);
    }
  } else if (variantDetails.length === 1) {
    const color = variantDetails[0].value;
    console.log(`✅ Single color variant: ${color}`);

    // Use zoom to get the true hi-res
    const src = await extractMainImageSrc();
    if (src && !savedImages.has(src)) {
      images.push({ handle, image: src, color });
      savedImages.add(src);
    }
  } else {
    console.log(`✅ Multiple color variants: ${variantDetails.length}`);
    const sortedVariants = variantDetails.sort(
      (a, b) => (b.isChecked ? 1 : 0) - (a.isChecked ? 1 : 0)
    );

    // Cache currently selected color's image first
    for (const variant of sortedVariants) {
      const color = variant.value;
      const labelLocator = variant.labelLocator;
      const inputHandle = await page
        .locator(`input[name="Color"][value="${color}"]`)
        .elementHandle();
      const currentlyChecked = await inputHandle?.evaluate((el) => el.checked);

      if (currentlyChecked) {
        // Grab hi-res for already selected color
        const src = await extractMainImageSrc();
        if (src && !savedImages.has(src)) {
          images.push({ handle, image: src, color });
          savedImages.add(src);
        } else if (src && savedImages.has(src)) {
          images.push({ handle, image: src, color });
        }
      }
    }

    // Now iterate the rest; click color, wait for UI, open zoom, read src
    for (const variant of sortedVariants) {
      const color = variant.value;
      const labelLocator = variant.labelLocator;

      try {
        // If not checked, click to switch
        const inputHandle = await page
          .locator(`input[name="Color"][value="${color}"]`)
          .elementHandle();
        const isChecked = await inputHandle?.evaluate((el) => el.checked);

        if (!isChecked) {
          console.log(`🎨 Selecting color: ${color}`);
          await labelLocator.click({ timeout: 20000 });
          // Wait for the radio to actually be checked
          await page.waitForFunction(
            (c) => {
              const el = document.querySelector(`input[name="Color"][value="${c}"]`);
              return !!el && el.checked === true;
            },
            color,
            { timeout: 10000 }
          );
          // Give a short time for the gallery to update
          await page.waitForTimeout(600);
        }

        // Read hi-res from PhotoSwipe
        const src = await extractMainImageSrc();

        if (src && !savedImages.has(src)) {
          images.push({ handle, image: src, color });
          savedImages.add(src);
        } else if (src && savedImages.has(src)) {
          // It might be the same image but still associate to color
          images.push({ handle, image: src, color });
        } else {
          // Fallback to first saved image if nothing new
          const fallbackImage = [...savedImages][0] || "";
          images.push({ handle, image: fallbackImage, color });
          console.log(
            `⚠️ No new image found for "${color}", saving fallback image.`
          );
        }
      } catch (err) {
        console.warn(`⚠️ Could not select color "${color}":`, err.message);
      }
    }
  }

  // Deduplicate by first occurrence per color
  const colorImageMap = new Map();
  images.forEach((img) => {
    if (!colorImageMap.has(img.color)) {
      colorImageMap.set(img.color, img.image);
    }
  });

  const uniqueColors = [...colorImageMap.keys()];

  const mainRow = {
    Handle: handle,
    Title: title,
    "Body (HTML)": description,
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
