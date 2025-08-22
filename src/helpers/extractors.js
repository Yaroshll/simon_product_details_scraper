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

// Escape a string for CSS attribute selectors like [value="..."]
function cssEscapeValue(s = "") {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function readInlineHeroSrc(page) {
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

/* -------------------- thumbnails -------------------- */

// return a locator to all gallery thumbnail items (covers common Shopify themes)
function thumbnailsLocator(page) {
  return page.locator(
    [
      ".product__thumb",
      ".thumbnail-list__item",
      ".product-thumbnails li",
      ".product__thumbnails .thumbnail",
      ".product-gallery__thumbnail",
    ].join(", ")
  );
}

// click Nth thumbnail (0-based) and wait hero image to actually change
async function clickThumbnailAndWait(page, idx, prevInlineSrc) {
  const thumbs = thumbnailsLocator(page);
  const count = await thumbs.count();
  if (!count) return prevInlineSrc;

  const item = thumbs.nth(idx);
  const img = item.locator("img").first();
  if (await img.count()) {
    await img.click({ timeout: 5000 }).catch(async () => {
      await item.click({ timeout: 5000, force: true });
    });
  } else {
    await item.click({ timeout: 5000, force: true });
  }

  await page.waitForTimeout(100);
  await page.waitForLoadState("networkidle").catch(() => {});
  const newSrc = await waitForHeroSrcChange(page, prevInlineSrc);
  return newSrc;
}

/* -------------------- zoom -> hi-res -------------------- */

async function openZoomAndGetHiResSrc(page, prevSrc = "") {
  const toAbs = (s) => (s && s.startsWith("//") ? `https:${s}` : s || "");

  const hero = page.locator(".pdp-main-img:visible").first();
  const hasHero = await hero.count().then(c => c > 0);
  const heroAlt = hasHero ? hero
    : page.locator(".product-main-image img:visible, .product__main-photos img:visible").first();

  try {
    const container = heroAlt.locator("xpath=ancestor-or-self::*[contains(@class,'pdp-main-img-wrap') or contains(@class,'image-wrap')][1]");
    await container.hover({ trial: true }).catch(() => {});
    await container.hover().catch(() => {});
  } catch {}

  async function findZoomButtonHandle() {
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
          cont.querySelector("button.product__photo-zoom")
        );
      });
      if (btnInContainer && (await btnInContainer.asElement())) {
        return btnInContainer.asElement();
      }
    }
    const visibleBtn = page.locator("button.js-photoswipe__zoom:visible").first();
    if (await visibleBtn.count()) return visibleBtn.elementHandle();

    const anyBtn = page.locator("button.js-photoswipe__zoom").first();
    if (await anyBtn.count()) return anyBtn.elementHandle();

    return null;
  }

  const btnHandle = await findZoomButtonHandle();

  let opened = false;
  if (btnHandle) {
    try {
      await btnHandle.click({ timeout: 2000 });
      opened = true;
    } catch {
      try {
        await btnHandle.click({ force: true, timeout: 2000 });
        opened = true;
      } catch {}
    }
  }
  if (!opened) {
    try {
      await heroAlt.click({ force: true, timeout: 2000 });
      opened = true;
    } catch {}
  }

  try {
    await page.waitForSelector(".pswp__img", { state: "visible", timeout: 5000 });
  } catch {
    return await readInlineHeroSrc(page);
  }

  const prevAbs = toAbs(prevSrc);
  let srcAbs = "";
  for (let i = 0; i < 30; i++) {
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
    await page.waitForTimeout(100);
  }

  if (!srcAbs) {
    const fallback = await page.$$eval(".pswp__img", (imgs) => {
      const v = imgs.find(
        (img) => getComputedStyle(img).display !== "none" && img.getAttribute("src")
      );
      return v ? v.getAttribute("src") : "";
    });
    srcAbs = toAbs(fallback);
  }

  try { await page.keyboard.press("Escape"); } catch {}
  return srcAbs;
}

/* -------------------- image swap wait -------------------- */

async function waitForHeroSrcChange(page, prevSrc) {
  const normalize = (s) => toAbsoluteUrl(s || "");
  const prev = normalize(prevSrc);

  for (let i = 0; i < 40; i++) {
    const current = await readInlineHeroSrc(page);
    if (current && normalize(current) !== prev) return current;
    await page.waitForTimeout(100);
  }
  return prev;
}

/* -------------------- robust selection helpers -------------------- */

// Return the currently-checked color value (if any)
async function getCheckedColor(page) {
  return await page.evaluate(() => {
    const candidates = [
      'input[name="Color"]:checked',
      'input[name="options[Color]"]:checked',
      'input[name="option-0"]:checked',
      'input[type="radio"][checked]',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.value) return el.value;
    }
    const selLbl = Array.from(document.querySelectorAll("label"))
      .find(l =>
        l.classList.contains("is-selected") ||
        l.getAttribute("aria-pressed") === "true" ||
        l.getAttribute("aria-checked") === "true"
      );
    if (selLbl) {
      const v = selLbl.getAttribute("data-value") || selLbl.textContent?.trim();
      if (v) return v;
    }
    return "";
  });
}

async function waitForColorSelected(page, color, timeoutMs = 8000) {
  const value = cssEscapeValue(color);
  try {
    await page.waitForFunction(
      (c) => {
        const radios = [
          `input[name="Color"][value="${c}"]`,
          `input[name="options[Color]"][value="${c}"]`,
          `input[name="option-0"][value="${c}"]`,
          `input[type="radio"][value="${c}"]`
        ];
        for (const r of radios) {
          const el = document.querySelector(r);
          if (el && (el.checked || el.getAttribute("checked") === "true")) return true;
        }
        const labels = Array.from(document.querySelectorAll('label, [data-value]'));
        for (const l of labels) {
          const val =
            l.getAttribute("data-value") ||
            l.getAttribute("data-swatch-value") ||
            l.textContent?.trim();
          if (!val) continue;
          if (val.toLowerCase() === c.toLowerCase()) {
            if (
              l.classList.contains("is-selected") ||
              l.classList.contains("active") ||
              l.getAttribute("aria-pressed") === "true" ||
              l.getAttribute("aria-checked") === "true" ||
              l.classList.contains("selected")
            ) {
              return true;
            }
          }
        }
        return false;
      },
      value,
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Click a color label and wait until selected or hero swaps.
 * Returns { checkedColor, newInlineSrc }.
 */
async function selectColorAndWait(page, labelLocator, color, prevInlineSrc) {
  if (labelLocator) {
    await labelLocator.click({ timeout: 10000 }).catch(async () => {
      const vEsc = cssEscapeValue(color);
      const input = page.locator(
        `input[name="Color"][value="${vEsc}"], ` +
        `input[name="options[Color]"][value="${vEsc}"], ` +
        `input[name="option-0"][value="${vEsc}"], ` +
        `input[type="radio"][value="${vEsc}"]`
      );
      if (await input.count()) await input.first().click({ force: true, timeout: 10000 });
    });
  }

  await page.waitForTimeout(100);
  await waitForColorSelected(page, color, 8000);

  await page.waitForLoadState("networkidle").catch(() => {});
  const newInlineSrc = await waitForHeroSrcChange(page, prevInlineSrc);

  const checkedColor = await getCheckedColor(page);
  return { checkedColor: checkedColor || color, newInlineSrc };
}

/* -------------------- main -------------------- */

export async function extractProductData(page, urlObj) {
  const { url, tags, brand, typeitem } = urlObj;

  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("domcontentloaded");

  const handle = formatHandleFromUrl(url);
  const title = (await page.textContent("h1.product-single__title"))?.trim() || "";
  const priceText = await page.textContent("span.product__price--compare");
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);

  // Find the option1 (Size) fieldset and collect ALL size values from data-value
  const sizeValues = await page.$$eval(
    'fieldset.variant-input-wrap[data-index="option1"] .variant-input[data-index="option1"][data-value], ' +
    'fieldset[data-index="option1"] .variant-input[data-index="option1"][data-value]',
    (nodes) =>
      Array.from(nodes)
        .map(n => n.getAttribute('data-value'))
        .filter(Boolean)
  );
  
  const option1Name = sizeValues.length ? "Size" : "";
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
      const isChecked = await inputElement?.evaluate((el) => el.checked).catch(() => false);
      const labelElement = await inputDiv.$("label.variant__button-label");
      if (value && labelElement) {
        const labelFor = await labelElement.getAttribute("for");
        variantDetails.push({
          value,
          isChecked,
          labelLocator: labelFor
            ? page.locator(`label.variant__button-label[for="${labelFor}"]`)
            : page.locator(`.variant-input[data-value="${cssEscapeValue(value)}"] .variant__button-label`),
        });
      }
    }
  }

  // capture the hi-res for the currently selected hero (after any swap)
  async function captureHiResForCurrentColor(color, prevInlineSrc = "") {
    const ensuredSrc = await waitForHeroSrcChange(page, prevInlineSrc);
    const hiRes = await openZoomAndGetHiResSrc(page, ensuredSrc);
    const srcFinal = hiRes || (await readInlineHeroSrc(page)) || "";
    if (srcFinal) {
      if (!savedImages.has(srcFinal)) {
        images.push({ handle, image: srcFinal, color });
        savedImages.add(srcFinal);
        return true;
      }
    }
    return false;
  }

  // No colors → capture hero (and all thumbnails if present)
  if (variantDetails.length === 0) {
    let currentInline = await readInlineHeroSrc(page);
    const thumbs = thumbnailsLocator(page);
    const tCount = await thumbs.count();
    if (!tCount) {
      await captureHiResForCurrentColor("", currentInline);
    } else {
      for (let i = 0; i < tCount; i++) {
        currentInline = await clickThumbnailAndWait(page, i, currentInline);
        await captureHiResForCurrentColor("", currentInline);
      }
    }
  }
  // Single color → SAVE ALL IMAGES
  else if (variantDetails.length === 1) {
    const color = variantDetails[0].value || (await getCheckedColor(page)) || "";
    let currentInline = await readInlineHeroSrc(page);
    const thumbs = thumbnailsLocator(page);
    const tCount = await thumbs.count();
    if (!tCount) {
      await captureHiResForCurrentColor(color, currentInline);
    } else {
      for (let i = 0; i < tCount; i++) {
        currentInline = await clickThumbnailAndWait(page, i, currentInline);
        await captureHiResForCurrentColor(color, currentInline);
      }
    }
  }
  // Multiple colors → Process each color exactly once
  else {
    // Get currently selected color first
    const initialCheckedColor = await getCheckedColor(page);
    let initialColorProcessed = false;
    
    // Process the initially selected color first
    for (const v of variantDetails) {
      if (v.value === initialCheckedColor || (!initialCheckedColor && v.isChecked)) {
        const prevInline = await readInlineHeroSrc(page);
        await captureHiResForCurrentColor(v.value, prevInline);
        initialColorProcessed = true;
        break;
      }
    }
    
    // If no color was initially selected, process the first one
    if (!initialColorProcessed && variantDetails.length > 0) {
      const prevInline = await readInlineHeroSrc(page);
      await captureHiResForCurrentColor(variantDetails[0].value, prevInline);
    }
    
    // Process all other colors exactly once
    for (const v of variantDetails) {
      // Skip if this is the initially selected/processed color
      if (v.value === initialCheckedColor || (!initialCheckedColor && v.isChecked)) {
        continue;
      }
      
      const prevInline = await readInlineHeroSrc(page);
      
      // CLICK COLOR, CONFIRM, ZOOM, SAVE
      const { checkedColor, newInlineSrc } = await selectColorAndWait(
        page, 
        v.labelLocator, 
        v.value, 
        prevInline
      );
      
      // Capture image for this color
      await captureHiResForCurrentColor(checkedColor || v.value, newInlineSrc);
    }
  }

  // Map first image per color
  const colorImageMap = new Map();
  for (const img of images) {
    if (!colorImageMap.has(img.color)) colorImageMap.set(img.color, img.image);
  }
  const uniqueColors = [...colorImageMap.keys()];

  // Create rows for each size and color combination
  const rows = [];
  
  // If we have sizes, create a row for each size
  if (sizeValues.length > 0) {
    for (const size of sizeValues) {
      // If we have colors, create a row for each color for this size
      if (uniqueColors.length > 0) {
        for (const color of uniqueColors) {
          rows.push({
            Handle: handle,
            Title: title,
            "Body (HTML)": description,
            Tags: tags,
            "Option1 Name": option1Name,
            "Option1 Value": size,
            "Option2 Name": "Color",
            "Option2 Value": color,
            "Variant Price": variantPrice.toFixed(2),
            "Cost per item": cost.toFixed(2),
            "Image Src": colorImageMap.get(color) || "",
            "product.metafields.custom.original_prodect_url": url,
            "Variant Fulfillment Service": "manual",
            "Variant Inventory Policy": "deny",
            "Variant Inventory Tracker": "shopify",
            "product.metafields.custom.brand": brand || "",
            "custom.item_type": typeitem || "",
            Type: "USA Products",
            Vendor: "simon",
            Published: "TRUE",
          });
        }
      } else {
        // No colors, just add the size
        rows.push({
          Handle: handle,
          Title: title,
          "Body (HTML)": description,
          Tags: tags,
          "Option1 Name": option1Name,
          "Option1 Value": size,
          "Option2 Name": "",
          "Option2 Value": "",
          "Variant Price": variantPrice.toFixed(2),
          "Cost per item": cost.toFixed(2),
          "Image Src": images[0]?.image || "",
          "product.metafields.custom.original_prodect_url": url,
          "Variant Fulfillment Service": "manual",
          "Variant Inventory Policy": "deny",
          "Variant Inventory Tracker": "shopify",
          "product.metafields.custom.brand": brand || "",
          "custom.item_type": typeitem || "",
          Type: "USA Products",
          Vendor: "simon",
          Published: "TRUE",
        });
      }
    }
  } else {
    // No sizes, create rows for each color
    if (uniqueColors.length > 0) {
      for (const color of uniqueColors) {
        rows.push({
          Handle: handle,
          Title: title,
          "Body (HTML)": description,
          Tags: tags,
          "Option1 Name": "",
          "Option1 Value": "",
          "Option2 Name": "Color",
          "Option2 Value": color,
          "Variant Price": variantPrice.toFixed(2),
          "Cost per item": cost.toFixed(2),
          "Image Src": colorImageMap.get(color) || "",
          "product.metafields.custom.original_prodect_url": url,
          "Variant Fulfillment Service": "manual",
          "Variant Inventory Policy": "deny",
          "Variant Inventory Tracker": "shopify",
          "product.metafields.custom.brand": brand || "",
          "custom.item_type": typeitem || "",
          Type: "USA Products",
          Vendor: "simon",
          Published: "TRUE",
        });
      }
    } else {
      // No sizes and no colors, just add the main product
      rows.push({
        Handle: handle,
        Title: "",
        "Body (HTML)": "",
        Tags: " ",
        "Option1 Name": "",
        "Option1 Value": "",
        "Option2 Name": "",
        "Option2 Value": "",
        "Variant Price":"",
        "Cost per item": "",
        "Image Src": images[0]?.image || "",
        "product.metafields.custom.original_prodect_url": "",
        "Variant Fulfillment Service": "",
        "Variant Inventory Policy": "",
        "Variant Inventory Tracker": "",
        "product.metafields.custom.brand":"",
        "custom.item_type":"",
        Type: "",
        Vendor: "",
        Published: "",
      });
    }
  }

  // Add extra images as separate rows
  const extraImages = images.slice(1).map((img) => ({
    Handle: handle,
    Title: "",
    "Body (HTML)": "",
    Tags: "",
    "Option1 Name": "",
    "Option1 Value": "",
    "Option2 Name": "",
    "Option2 Value": "",
    "Variant Price": "",
    "Cost per item": "",
    "Image Src": img.image,
    "product.metafields.custom.original_prodect_url": "",
    "Variant Fulfillment Service": "",
    "Variant Inventory Policy": "",
    "Variant Inventory Tracker": "",
    "product.metafields.custom.brand": "",
    "custom.item_type": "",
    Type: "",
    Vendor: "",
    Published: "",
  }));
  
  rows.push(...extraImages);

  return rows;
}