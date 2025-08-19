import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

/* -------------------- helpers -------------------- */

function toAbsoluteUrl(src) {
  if (!src) return "";
  return src.startsWith("//") ? `https:${src}` : src;
}

async function readInlineHeroSrc(page) {
  // Try multiple hero selectors; return the best URL we can get
  const sel = [".pdp-main-img", ".product-main-image img", ".product__main-photos img"];
  for (const s of sel) {
    const exists = await page.$(s);
    if (!exists) continue;
    try {
      const src = await page.$eval(s, (img) => {
        const srcset = img.getAttribute("srcset");
        if (srcset) {
          const parts = srcset.split(",").map(p => p.trim().split(" ")[0]).filter(Boolean);
          if (parts.length) return parts[parts.length - 1];
        }
        return img.currentSrc || img.getAttribute("data-photoswipe-src") || img.getAttribute("src") || "";
      });
      if (src) return toAbsoluteUrl(src);
    } catch {}
  }
  return "";
}

async function openZoomAndGetHiResSrc(page, prevSrc = "") {
  // Click zoom button → wait PhotoSwipe → choose visible non-placeholder → ensure high-res
  const zoomBtn = page.locator('button.js-photoswipe__zoom');
  await zoomBtn.waitFor({ state: "visible", timeout: 10000 });
  await zoomBtn.click();

  // Wait a visible image exists
  await page.waitForSelector(".pswp__img", { state: "visible", timeout: 10000 });

  // Wait until we have a "new" (not placeholder) src that differs from prevSrc and is reasonably large
  const newSrc = await page.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll(".pswp__img"));
    const visible = imgs.find((img) => getComputedStyle(img).display !== "none");
    if (!visible) return null;
    const isPlaceholder = visible.classList.contains("pswp__img--placeholder");
    const src = visible.getAttribute("src") || "";
    if (!src) return null;

    // Surface values to outer scope
    return { src, naturalWidth: visible.naturalWidth, isPlaceholder };
  }, {}, { polling: 100, timeout: 15000 }).then(async (val) => {
    // poll until it’s not placeholder, different from prev, and big enough
    for (let i = 0; i < 50; i++) {
      const v = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll(".pswp__img"));
        const visible = imgs.find((img) => getComputedStyle(img).display !== "none");
        if (!visible) return { src: "", naturalWidth: 0, isPlaceholder: true };
        return {
          src: visible.getAttribute("src") || "",
          naturalWidth: visible.naturalWidth || 0,
          isPlaceholder: visible.classList.contains("pswp__img--placeholder"),
        };
      });
      const srcAbs = toAbsoluteUrl(v.src);
      const changed = prevSrc ? srcAbs !== toAbsoluteUrl(prevSrc) : true;
      if (v.src && !v.isPlaceholder && v.naturalWidth >= 1000 && changed) return srcAbs;
      await page.waitForTimeout(120);
    }
    // Fallback: first non-empty visible src
    const fallback = await page.$$eval(".pswp__img", (imgs) => {
      const v = imgs.find((img) => getComputedStyle(img).display !== "none" && img.getAttribute("src"));
      return v ? v.getAttribute("src") : "";
    });
    return toAbsoluteUrl(fallback || "");
  });

  // Close modal
  try { await page.keyboard.press("Escape"); } catch {}

  return newSrc || "";
}

/**
 * After clicking a color, wait for the "hero" image URL to actually change
 * Some sites keep the same node and swap only the src/srcset/currentSrc.
 */
async function waitForHeroSrcChange(page, prevSrc) {
  const normalize = (s) => toAbsoluteUrl(s || "");
  const prev = normalize(prevSrc);

  // Poll both inline hero and PhotoSwipe candidate (if open later)
  for (let i = 0; i < 80; i++) {
    const current = await readInlineHeroSrc(page);
    if (current && normalize(current) !== prev) return current;
    await page.waitForTimeout(120);
  }
  // If hero never changes (rare), return prev; zoom stage will still enforce change
  return prev;
}

/* -------------------- main -------------------- */

export async function extractProductData(page, urlObj) {
  const { url, tags, brand, typeitem } = urlObj;

  await page.goto(url, { waitUntil: "load", timeout: 700000 });
  await page.waitForLoadState("domcontentloaded");

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

  // Build color list
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
          labelLocator: page.locator(`label.variant__button-label[for="${labelFor}"]`),
        });
      }
    }
  }

  // Helper to capture high-res for whatever color is currently selected
  async function captureHiResForCurrentColor(color, prevInlineSrc = "") {
    // Ensure hero really swapped (prevents “first image for all colors”)
    await waitForHeroSrcChange(page, prevInlineSrc);

    // Open zoom and get hi-res different from previous src
    const hiRes = await openZoomAndGetHiResSrc(page, prevInlineSrc);
    const srcFinal = hiRes || (await readInlineHeroSrc(page)) || "";

    if (srcFinal) {
      images.push({ handle, image: srcFinal, color });
      // We still remember it to help with fallbacks, but do NOT block same src for another color
      savedImages.add(srcFinal);
    } else {
      // Last-ditch: reuse first saved (keeps CSV structure)
      const fallback = [...savedImages][0] || "";
      images.push({ handle, image: fallback, color });
    }
  }

  // No colors
  if (variantDetails.length === 0) {
    const prev = await readInlineHeroSrc(page);
    await captureHiResForCurrentColor("", prev);
  }
  // Single color
  else if (variantDetails.length === 1) {
    const color = variantDetails[0].value;
    const prev = await readInlineHeroSrc(page);
    await captureHiResForCurrentColor(color, prev);
  }
  // Multiple colors
  else {
    const sorted = variantDetails.sort((a, b) => (b.isChecked ? 1 : 0) - (a.isChecked ? 1 : 0));

    // First, grab the already-selected color
    for (const v of sorted) {
      const color = v.value;
      const input = await page.locator(`input[name="Color"][value="${color}"]`).elementHandle();
      const checked = await input?.evaluate((el) => el.checked);
      if (checked) {
        const prev = await readInlineHeroSrc(page);
        await captureHiResForCurrentColor(color, prev);
      }
    }

    // Then iterate others
    for (const v of sorted) {
      const color = v.value;
      const input = await page.locator(`input[name="Color"][value="${color}"]`).elementHandle();
      const isChecked = await input?.evaluate((el) => el.checked);

      if (!isChecked) {
        const prevInline = await readInlineHeroSrc(page);
        await v.labelLocator.click({ timeout: 20000 });

        // Wait radio becomes checked
        await page.waitForFunction(
          (c) => {
            const el = document.querySelector(`input[name="Color"][value="${c}"]`);
            return !!el && el.checked === true;
          },
          color,
          { timeout: 10000 }
        );

        // Let the gallery do its thing
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(200);

        await captureHiResForCurrentColor(color, prevInline);
      }
    }
  }

  // Map first image per color
  const colorImageMap = new Map();
  for (const img of images) {
    if (!colorImageMap.has(img.color)) colorImageMap.set(img.color, img.image);
  }
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
