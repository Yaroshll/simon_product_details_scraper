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

function cssEscapeValue(s = "") {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function fixTextEncoding(s = "") {
  return s
    .replace(/â€™/g, "’")
    .replace(/â€œ/g, "“")
    .replace(/â€�/g, "”")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€‹/g, "")
    .replace(/â€³|â€/g, "”")
    .replace(/â€¢/g, "•")
    .replace(/â€/g, "'");
}

/** Return the largest URL from a srcset string */
function pickLargestFromSrcset(srcset) {
  if (!srcset) return "";
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .map((p) => {
      const [url, size] = p.split(" ");
      const n = parseInt(size || "0", 10);
      return { url, n: isNaN(n) ? 0 : n };
    })
    .sort((a, b) => b.n - a.n);
  return parts[0]?.url || "";
}

/* -------------------- hero readers -------------------- */

/**
 * Try to read the visible hero img; prefer data-photoswipe-src (hi-res 1800x1800),
 * else the largest srcset/currentSrc/src.
 */
async function readHiResHero(page) {
  // common hero selectors (first match wins)
  const selectors = [
    // the one you asked for specifically:
    'img.photoswipe__image.pdp-main-img',
    // other common hero patterns:
    '.pdp-main-img',
    '.product-main-image img',
    '.product__main-photos img',
    '.product__media-item.is-active img',
    '.slider__slide.is-active img',
  ];

  for (const s of selectors) {
    const exists = await page.$(s);
    if (!exists) continue;

    try {
      const data = await page.$eval(s, (img) => {
        const rawData = img.getAttribute("data-photoswipe-src") || "";
        const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
        const current = img.currentSrc || img.getAttribute("src") || "";
        return { rawData, srcset, current };
      });

      // Prefer data-photoswipe-src (hi-res 1800x1800)
      if (data.rawData) return toAbsoluteUrl(data.rawData);

      // Else pick largest from srcset, else currentSrc/src
      const fromSet = pickLargestFromSrcset(data.srcset);
      if (fromSet) return toAbsoluteUrl(fromSet);
      if (data.current) return toAbsoluteUrl(data.current);
    } catch {}
  }

  return "";
}

/** Wait until the hero image URL actually changes */
async function waitForHeroSrcChange(page, prevSrc, tries = 30, delay = 80) {
  const normalize = (s) => toAbsoluteUrl(s || "");
  const prev = normalize(prevSrc);
  for (let i = 0; i < tries; i++) {
    const current = await readHiResHero(page);
    if (current && normalize(current) !== prev) return current;
    await page.waitForTimeout(delay);
  }
  return prev;
}

/* -------------------- thumbnails -------------------- */

function thumbnailsLocator(page) {
  return page.locator(
    [
      "[data-media-id].product__thumb",
      ".thumbnail-list__item [data-media-id]",
      ".thumbnail-list__item",
      ".product-thumbnails li",
      ".product__thumbnails .thumbnail",
      ".product-gallery__thumbnail",
    ].join(", ")
  );
}

async function clickThumbnailAndWait(page, idx, prevInlineSrc) {
  const thumbs = thumbnailsLocator(page);
  const count = await thumbs.count();
  if (!count) return prevInlineSrc;

  const item = thumbs.nth(idx);
  await item.click({ timeout: 4000, force: true }).catch(() => {});
  await page.waitForTimeout(100);
  await page.waitForLoadState("networkidle").catch(() => {});
  return await waitForHeroSrcChange(page, prevInlineSrc);
}

/* -------------------- color selection helpers -------------------- */

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
    const selLbl = Array.from(document.querySelectorAll("label")).find(
      (l) =>
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
          `input[type="radio"][value="${c}"]`,
        ];
        for (const r of radios) {
          const el = document.querySelector(r);
          if (el && (el.checked || el.getAttribute("checked") === "true")) return true;
        }
        const labels = Array.from(document.querySelectorAll("label, [data-value]"));
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
            ) return true;
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
 * Click a color label/input and wait until selection + hero swap.
 * Returns { checkedColor, newHero } where newHero is the hi-res URL (pref from data-photoswipe-src).
 */
async function selectColorAndReadHero(page, labelLocator, color, prevHero) {
  // Click label or matching input
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

  await page.waitForTimeout(80);
  await waitForColorSelected(page, color, 8000);

  await page.waitForLoadState("networkidle").catch(() => {});
  const newHero = await waitForHeroSrcChange(page, prevHero);

  const checkedColor = await getCheckedColor(page);
  return { checkedColor: checkedColor || color, newHero };
}

/* -------------------- main -------------------- */

export async function extractProductData(page, urlObj) {
  const { url, tags, brand, typeitem } = urlObj;

  await page.goto(url, { waitUntil: "load", timeout: 70000 });
  await page.waitForLoadState("domcontentloaded");

  const handle = formatHandleFromUrl(url);

  const rawTitle = (await page.textContent("h1.product-single__title"))?.trim() || "";
  const rawDesc = (await page.textContent(".pdp-details-txt"))?.trim() || "";
  const title = fixTextEncoding(rawTitle);
  const description = fixTextEncoding(rawDesc);

  const priceText = await page.textContent("span.product__price--compare");
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);

  /* ---- sizes (option1) -> list all; each size gets its own row ---- */
  const sizeValues = await page.$$eval(
    'fieldset.variant-input-wrap[data-index="option1"] .variant-input[data-index="option1"][data-value], ' +
      'fieldset[data-index="option1"] .variant-input[data-index="option1"][data-value]',
    (nodes) => Array.from(nodes).map((n) => n.getAttribute("data-value")).filter(Boolean)
  );
  const hasSizes = sizeValues.length > 0;

  /* ---- colors (fieldset[name="Color"]) ---- */
  const colorFieldset = await page.$('fieldset[name="Color"]');
  const variantDetails = [];
  if (colorFieldset) {
    const variantInputs = await colorFieldset.$$(".variant-input");
    for (const inputDiv of variantInputs) {
      const value = await inputDiv.getAttribute("data-value");
      const labelElement = await inputDiv.$("label.variant__button-label");
      if (value && labelElement) {
        const labelFor = await labelElement.getAttribute("for");
        variantDetails.push({
          value,
          labelLocator: labelFor
            ? page.locator(`label.variant__button-label[for="${labelFor}"]`)
            : page.locator(
                `.variant-input[data-value="${cssEscapeValue(value)}"] .variant__button-label`
              ),
        });
      }
    }
  }

  const images = []; // { handle, image, color }

  /** Capture one hi-res image for the current hero (mapped to a color value). */
  async function captureHiResForColor(color, prevHero = "") {
    const ensured = await waitForHeroSrcChange(page, prevHero);
    const hi = await readHiResHero(page); // prefers data-photoswipe-src
    const final = hi || ensured || (await readHiResHero(page)) || "";
    images.push({ handle, image: final, color });
  }

  /* === image capture === */

  // 0) read initial hero
  let currentHero = await readHiResHero(page);

  if (variantDetails.length === 0) {
    // No colors → capture hero (and all thumbs if present) with empty color
    const thumbs = thumbnailsLocator(page);
    const tCount = await thumbs.count();
    if (!tCount) {
      await captureHiResForColor("", currentHero);
    } else {
      for (let i = 0; i < tCount; i++) {
        currentHero = await clickThumbnailAndWait(page, i, currentHero);
        await captureHiResForColor("", currentHero);
      }
    }
  } else if (variantDetails.length === 1) {
    // Single color → save all images for that color
    const color = variantDetails[0].value || (await getCheckedColor(page)) || "";
    const thumbs = thumbnailsLocator(page);
    const tCount = await thumbs.count();
    if (!tCount) {
      await captureHiResForColor(color, currentHero);
    } else {
      for (let i = 0; i < tCount; i++) {
        currentHero = await clickThumbnailAndWait(page, i, currentHero);
        await captureHiResForColor(color, currentHero);
      }
    }
  } else {
    // Multiple colors → selected first, then others; ALWAYS click color → wait → read data-photoswipe-src
    const seen = new Set();

    // First: currently selected (if detectable), else first entry
    const initialCheckedColor = await getCheckedColor(page);
    const firstEntry =
      (initialCheckedColor &&
        variantDetails.find((v) => v.value === initialCheckedColor)) ||
      variantDetails[0];

    if (firstEntry?.labelLocator) {
      const res = await selectColorAndReadHero(page, firstEntry.labelLocator, firstEntry.value, currentHero);
      currentHero = res.newHero;
      const cVal = (res.checkedColor || firstEntry.value);
      await captureHiResForColor(cVal, currentHero);
      seen.add(cVal.toLowerCase());
    }

    // Then: remaining colors (no repeats)
    for (const v of variantDetails) {
      const key = (v.value || "").toLowerCase();
      if (!key || seen.has(key)) continue;

      const res = await selectColorAndReadHero(page, v.labelLocator, v.value, currentHero);
      currentHero = res.newHero;
      const cVal = res.checkedColor || v.value;
      await captureHiResForColor(cVal, currentHero);
      seen.add(cVal.toLowerCase());
    }
  }

  /* === build rows (Size × Color) === */

  const allColorValues = variantDetails.map((v) => v.value);
  const hasColors = allColorValues.length > 0;

  // first image per color
  const colorImageMap = new Map();
  for (const img of images) {
    if (!colorImageMap.has(img.color)) colorImageMap.set(img.color, img.image);
  }

  function makeRow({ size, color, isMain }) {
    return {
      Handle: handle,
      Title: isMain ? title : "",
      "Body (HTML)": isMain ? description : "",
      Tags: isMain ? tags : "",
      "Option1 Name": hasSizes ? "Size" : "",
      "Option1 Value": hasSizes ? size || "" : "",
      "Option2 Name": hasColors ? "Color" : "",
      "Option2 Value": hasColors ? color || "" : "",
      "Variant Price": variantPrice.toFixed(2),
      "Cost per item": cost.toFixed(2),
      "Image Src": hasColors ? (colorImageMap.get(color) || "") : (images[0]?.image || ""),
      "product.metafields.custom.original_prodect_url": isMain ? url : "",
      "Variant Fulfillment Service": "manual",
      "Variant Inventory Policy": "deny",
      "Variant Inventory Tracker": "shopify",
      "product.metafields.custom.brand": brand || "",
      "custom.item_type": typeitem || "",
      Type: isMain ? "USA Products" : "",
      Vendor: isMain ? "simon" : "",
      Published: isMain ? "TRUE" : "",
    };
  }

  const rows = [];
  if (hasSizes && hasColors) {
    let first = true;
    for (const size of sizeValues) {
      for (const color of allColorValues) {
        rows.push(makeRow({ size, color, isMain: first }));
        first = false;
      }
    }
  } else if (hasSizes && !hasColors) {
    let first = true;
    for (const size of sizeValues) {
      rows.push(makeRow({ size, color: "", isMain: first }));
      first = false;
    }
  } else if (!hasSizes && hasColors) {
    let first = true;
    for (const color of allColorValues) {
      rows.push(makeRow({ size: "", color, isMain: first }));
      first = false;
    }
  } else {
    rows.push(makeRow({ size: "", color: "", isMain: true }));
  }

  return rows;
}
