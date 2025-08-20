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

/* -------------------- zoom -> hi-res -------------------- */

/**
 * Find & click the correct zoom button tied to the visible hero image,
 * then return a stable hi-res PhotoSwipe src (different from prevSrc).
 */
async function openZoomAndGetHiResSrc(page, prevSrc = "") {
  // Helper: normalize protocol-relative URLs
  const toAbs = (s) => (s && s.startsWith("//") ? `https:${s}` : s || "");

  // 1) Get the currently visible hero image element
  const hero = page.locator(".pdp-main-img:visible").first();

  // Some themes don’t use .pdp-main-img; widen the net if missing
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

  // 4) Open zoom: click button if we found one, else click the image
  let opened = false;
  if (btnHandle) {
    try {
      await btnHandle.click({ timeout: 3000 });
      opened = true;
    } catch {
      try {
        await btnHandle.click({ force: true, timeout: 3000 });
        opened = true;
      } catch {}
    }
  }
  if (!opened) {
    try {
      await heroAlt.click({ force: true, timeout: 3000 });
      opened = true;
    } catch {}
  }

  // 5) Wait for PhotoSwipe to appear
  try {
    await page.waitForSelector(".pswp__img", { state: "visible", timeout: 8000 });
  } catch {
    // If no PhotoSwipe, return inline hero (some PDPs don’t use zoom)
    return await readInlineHeroSrc(page);
  }

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

  for (let i = 0; i < 80; i++) {
    const current = await readInlineHeroSrc(page);
    if (current && normalize(current) !== prev) return current;
    await page.waitForTimeout(120);
  }
  return prev;
}

/* -------------------- selection helpers (robust) -------------------- */

// Return the currently-checked color value (if any) — tries multiple patterns
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

async function waitForColorSelected(page, color, timeoutMs = 12000) {
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
 * Click a color label (provided) and wait until:
 *   A) that color is “selected” (radios/labels) OR
 *   B) the hero image swaps from prevInlineSrc
 * Returns { checkedColor, newInlineSrc }.
 */
async function selectColorAndWait(page, labelLocator, color, prevInlineSrc) {
  if (labelLocator) {
    await labelLocator.click({ timeout: 20000 }).catch(async () => {
      const vEsc = cssEscapeValue(color);
      const input = page.locator(
        `input[name="Color"][value="${vEsc}"], ` +
        `input[name="options[Color]"][value="${vEsc}"], ` +
        `input[name="option-0"][value="${vEsc}"], ` +
        `input[type="radio"][value="${vEsc}"]`
      );
      if (await input.count()) await input.first().click({ force: true, timeout: 20000 });
    });
  }

  await page.waitForTimeout(150);
  const selected = await waitForColorSelected(page, color, 12000);

  await page.waitForLoadState("networkidle").catch(() => {});
  const newInlineSrc = await waitForHeroSrcChange(page, prevInlineSrc);

  const checkedColor = await getCheckedColor(page);
  return { checkedColor: checkedColor || (selected ? color : ""), newInlineSrc };
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
  // Extract option1 (Size etc.)
  const option1Div = await page.$('.variant-input[data-index="option1"][data-value]');
  const option1Name = option1Div
    ? (await option1Div.$eval('input[type="radio"]', el => el.getAttribute("name"))) || ""
    : "";
  const option1Value = option1Div
    ? (await option1Div.getAttribute("data-value")) || ""
    : "";

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

  // Helper to capture hi-res for whatever color is currently selected
  async function captureHiResForCurrentColor(color, prevInlineSrc = "") {
    const ensuredSrc = await waitForHeroSrcChange(page, prevInlineSrc);
    const hiRes = await openZoomAndGetHiResSrc(page, ensuredSrc);
    const srcFinal = hiRes || (await readInlineHeroSrc(page)) || "";

    if (srcFinal) {
      images.push({ handle, image: srcFinal, color });
      savedImages.add(srcFinal);
    } else {
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
    const checked = await getCheckedColor(page);
    await captureHiResForCurrentColor(checked || color, prev);
  }
  // Multiple colors
  else {
    const sorted = variantDetails.sort((a, b) => (b.isChecked ? 1 : 0) - (a.isChecked ? 1 : 0));

    // 1) handle the already-selected color first (no click)
    for (const v of sorted) {
      const input = await page.locator(`input[name="Color"][value="${cssEscapeValue(v.value)}"]`).elementHandle().catch(() => null);
      const checked = input ? await input.evaluate((el) => el.checked).catch(() => false) : false;
      if (checked || v.isChecked) {
        const prev = await readInlineHeroSrc(page);
        const actualChecked = await getCheckedColor(page);
        await captureHiResForCurrentColor(actualChecked || v.value, prev);
        break;
      }
    }

    // 2) iterate the rest; click label → confirm (or image swap) → capture
    for (const v of sorted) {
      const input = await page.locator(`input[name="Color"][value="${cssEscapeValue(v.value)}"]`).elementHandle().catch(() => null);
      const isChecked = input ? await input.evaluate((el) => el.checked).catch(() => false) : false;
      if (!isChecked && !v.isChecked) {
        const prevInline = await readInlineHeroSrc(page);
        const { checkedColor, newInlineSrc } = await selectColorAndWait(page, v.labelLocator, v.value, prevInline);
        await captureHiResForCurrentColor(checkedColor || v.value, newInlineSrc);
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
    "Option2 Name": uniqueColors.length ? "Color" : "",
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
