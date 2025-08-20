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

/**
 * Find & click the correct zoom button tied to the visible hero image,
 * then return a stable hi-res PhotoSwipe src (different from prevSrc).
 */
async function openZoomAndGetHiResSrc(page, prevSrc = "") {
  // Helper: normalize protocol-relative URLs
  const toAbs = (s) => (s && s.startsWith("//") ? `https:${s}` : s || "");

  // 1) Get the currently visible hero image element
  const hero = page.locator(".pdp-main-img:visible").first();

  // Some themes don't use .pdp-main-img; widen the net if missing
  const hasHero = await hero.count().then(c => c > 0);
  const heroAlt = hasHero ? hero
    : page.locator(
        ".product-main-image img:visible, .product__main-photos img:visible"
      ).first();

  // 2) Try to hover the image container to reveal the zoom button
  try {
    const container = heroAlt.locator("xpath=ancestor-or-self::*[contains(@class,'pdp-main-img-wrap') or contains(@class,'image-wrap')][1]");
    await container.hover({ trial: true }).catch(() => {});
    await container.hover().catch(() => {});
  } catch {}

  // 3) Prefer the zoom button inside the same image container
  async function findZoomButtonHandle() {
    // Try "closest" container → query for a button within
    const handle = await heroAlt.elementHandle();
    if (handle) {
      const btnInContainer = await handle.evaluateHandle((img) => {
        const cont =
          img.closest(".pdp-main-img-wrap") ||
          img.closest(".image-wrap") ||
          img.parentElement;
        if (!cont) return null;
        return (
          cont.querySelector("button.js-photoswipe__zoom") ||
          cont.querySelector("button.product__photo-zoom") ||
          cont.querySelector("[data-zoom-button]")
        );
      });
      if (btnInContainer && (await btnInContainer.asElement())) {
        return btnInContainer.asElement();
      }
    }

    // Fallback: any visible zoom button
    const visibleBtn = page.locator("button.js-photoswipe__zoom:visible, button.product__photo-zoom:visible, [data-zoom-button]:visible").first();
    if (await visibleBtn.count()) return visibleBtn.elementHandle();

    // Last resort: first button in DOM (will force-click)
    const anyBtn = page.locator("button.js-photoswipe__zoom, button.product__photo-zoom, [data-zoom-button]").first();
    if (await anyBtn.count()) return anyBtn.elementHandle();

    return null;
  }

  const btnHandle = await findZoomButtonHandle();

  // 4) Open zoom: click button if we found one, else click the image
  let opened = false;
  if (btnHandle) {
    try {
      // Try normal click first
      await btnHandle.click({ timeout: 3000 });
      opened = true;
    } catch {
      // Force click (button may be present but "not visible")
      try {
        await btnHandle.click({ force: true, timeout: 3000 });
        opened = true;
      } catch {}
    }
  }
  if (!opened) {
    // Click the hero image itself (many themes bind zoom to the image)
    try {
      await heroAlt.click({ force: true, timeout: 3000 });
      opened = true;
    } catch {}
  }

  // 5) Wait for PhotoSwipe to appear
  await page.waitForSelector(".pswp__img", { state: "visible", timeout: 10000 });

  // 6) Wait for a non-placeholder visible image whose src differs from prevSrc
  const prevAbs = toAbs(prevSrc);
  let srcAbs = "";
  for (let i = 0; i < 60; i++) {
    const v = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll(".pswp__img"));
      const visible = imgs.find((img) => getComputedStyle(img).display !== "none");
      if (!visible) return { src: "", n: 0, placeholder: true };
      return {
        src: visible.getAttribute("src") || "",
        n: visible.naturalWidth || 0,
        placeholder: visible.classList.contains("pswp__img--placeholder"),
      };
    });
    const candidate = toAbs(v.src);
    const changed = prevAbs ? candidate !== prevAbs : Boolean(candidate);
    if (candidate && !v.placeholder && v.n >= 1000 && changed) {
      srcAbs = candidate;
      break;
    }
    await page.waitForTimeout(120);
  }

  // Fallback: grab any visible .pswp__img src
  if (!srcAbs) {
    const fallback = await page.$$eval(".pswp__img", (imgs) => {
      const v = imgs.find(
        (img) => getComputedStyle(img).display !== "none" && img.getAttribute("src")
      );
      return v ? v.getAttribute("src") : "";
    });
    srcAbs = toAbs(fallback);
  }

  // 7) Close zoom
  try { await page.keyboard.press("Escape"); } catch {}

  return srcAbs;
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

  await page.goto(url, { waitUntil: "load", timeout: 70000 });
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

  // No colors
  if (variantDetails.length === 0) {
    console.log("⚠️ No color variants found. Skipping color logic.");
    const prev = await readInlineHeroSrc(page);
    const hiRes = await openZoomAndGetHiResSrc(page, prev);
    const srcFinal = hiRes || prev || "";
    if (srcFinal) {
      images.push({ handle, image: srcFinal, color: "" });
      savedImages.add(srcFinal);
    }
  }
  // Single color
  else if (variantDetails.length === 1) {
    const color = variantDetails[0].value;
    console.log(`✅ Single color variant: ${color}`);
    const prev = await readInlineHeroSrc(page);
    const hiRes = await openZoomAndGetHiResSrc(page, prev);
    const srcFinal = hiRes || prev || "";
    if (srcFinal) {
      images.push({ handle, image: srcFinal, color });
      savedImages.add(srcFinal);
    }
  }
  // Multiple colors
  else {
    console.log(`✅ Multiple color variants: ${variantDetails.length}`);
    const sortedVariants = variantDetails.sort(
      (a, b) => (b.isChecked ? 1 : 0) - (a.isChecked ? 1 : 0)
    );

    // First, capture the initial/default color image
    for (const variant of sortedVariants) {
      const color = variant.value;
      const inputHandle = await page
        .locator(`input[name="Color"][value="${color}"]`)
        .elementHandle();
      const currentlyChecked = await inputHandle?.evaluate((el) => el.checked);

      if (currentlyChecked) {
        console.log(`📸 Capturing initial images for color: ${color}`);
        const prev = await readInlineHeroSrc(page);
        const hiRes = await openZoomAndGetHiResSrc(page, prev);
        const srcFinal = hiRes || prev || "";
        
        if (srcFinal && !savedImages.has(srcFinal)) {
          images.push({ handle, image: srcFinal, color });
          savedImages.add(srcFinal);
          console.log(`✅ Saved image for ${color}: ${srcFinal.substring(0, 50)}...`);
        }
        break;
      }
    }

    // Then iterate through other colors
    for (const variant of sortedVariants) {
      const color = variant.value;
      const labelLocator = variant.labelLocator;
      const inputHandle = await page
        .locator(`input[name="Color"][value="${color}"]`)
        .elementHandle();
      const currentlyChecked = await inputHandle?.evaluate((el) => el.checked);

      if (!currentlyChecked) {
        try {
          console.log(`🎨 Selecting color: ${color}`);
          
          // Get current image source before clicking
          const prevSrc = await readInlineHeroSrc(page);
          
          // Click the color option
          await labelLocator.click({ timeout: 30000 });
          
          // Wait for the page to update
          await page.waitForFunction(
            (colorValue) => {
              const input = document.querySelector(`input[name="Color"][value="${colorValue}"]`);
              return input && input.checked;
            },
            color,
            { timeout: 10000 }
          );
          
          // Wait for images to load
          await page.waitForTimeout(2000);
          
          // Wait for hero image to change
          await waitForHeroSrcChange(page, prevSrc);
          
          // Open zoom and get hi-res image
          const hiRes = await openZoomAndGetHiResSrc(page, prevSrc);
          const srcFinal = hiRes || (await readInlineHeroSrc(page)) || "";
          
          if (srcFinal && !savedImages.has(srcFinal)) {
            images.push({ handle, image: srcFinal, color });
            savedImages.add(srcFinal);
            console.log(`✅ Saved image for ${color}: ${srcFinal.substring(0, 50)}...`);
          } else {
            console.log(`⚠️ No new image found for "${color}"`);
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

  // Map first image per color
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