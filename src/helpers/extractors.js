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

async function clickThumbnailAndWait(page, idx, prevInlineSrc) {
  const thumbs = thumbnailsLocator(page);
  const count = await thumbs.count();
  if (!count) return prevInlineSrc;

  const item = thumbs.nth(idx);
  const img = item.locator("img").first();
  if (await img.count()) {
    await img.click({ timeout: 4000 }).catch(async () => {
      await item.click({ timeout: 4000, force: true });
    });
  } else {
    await item.click({ timeout: 4000, force: true });
  }

  await page.waitForTimeout(120);
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

  try {
    await page.waitForSelector(".pswp__img", { state: "visible", timeout: 3000 });
  } catch {
    return await readInlineHeroSrc(page);
  }

  const prevAbs = toAbs(prevSrc);
  let srcAbs = "";
  for (let i = 0; i < 40; i++) {
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

  await page.waitForTimeout(120);
  await waitForColorSelected(page, color, 12000);

  await page.waitForLoadState("networkidle").catch(() => {});
  const newInlineSrc = await waitForHeroSrcChange(page, prevInlineSrc);

  const checkedColor = await getCheckedColor(page);
  return { checkedColor: checkedColor || color, newInlineSrc };
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

  // sizes (option1): collect all
  const sizeValues = await page.$$eval(
    'fieldset.variant-input-wrap[data-index="option1"] .variant-input[data-index="option1"][data-value], ' +
    'fieldset[data-index="option1"] .variant-input[data-index="option1"][data-value]',
    (nodes) => Array.from(nodes).map(n => n.getAttribute('data-value')).filter(Boolean)
  );
  const hasSizes = sizeValues.length > 0;
  const option1Name = hasSizes ? "Size" : "";
  const option1ValueForMain = hasSizes ? sizeValues[0] : "";

  const description = (await page.textContent(".pdp-details-txt"))?.trim() || "";

  const images = [];

  // Build color list from fieldset
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
            : page.locator(`.variant-input[data-value="${cssEscapeValue(value)}"] .variant__button-label`),
        });
      }
    }
  }

  // Helper: capture hi-res tied to current color
  async function captureHiResForCurrentColor(color, prevInlineSrc = "") {
    const ensuredSrc = await waitForHeroSrcChange(page, prevInlineSrc);
    const hasZoom = await page.locator("button.js-photoswipe__zoom, button.product__photo-zoom").count();
    const hiRes = hasZoom ? await openZoomAndGetHiResSrc(page, ensuredSrc) : "";
    const srcFinal = hiRes || (await readInlineHeroSrc(page)) || "";
    images.push({ handle, image: srcFinal, color });
  }

  // === Image capture ===
  if (variantDetails.length === 0) {
    // no colors: capture all thumbnails
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
  } else if (variantDetails.length === 1) {
    // single color: save all images for that color
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
  } else {
    // multiple colors: selected first, then others (no repeats)
    const seen = new Set();

    const initialCheckedColor = await getCheckedColor(page);
    if (initialCheckedColor) {
      const prevInline = await readInlineHeroSrc(page);
      const initEntry = variantDetails.find(v => v.value === initialCheckedColor) || variantDetails[0];
      if (initEntry?.labelLocator) {
        const { checkedColor, newInlineSrc } = await selectColorAndWait(page, initEntry.labelLocator, initEntry.value, prevInline);
        await captureHiResForCurrentColor(checkedColor || initEntry.value, newInlineSrc);
        seen.add((checkedColor || initEntry.value).toLowerCase());
      }
    }

    for (const v of variantDetails) {
      const key = (v.value || "").toLowerCase();
      if (!key || seen.has(key)) continue;

      const prevInline = await readInlineHeroSrc(page);
      const { checkedColor, newInlineSrc } = await selectColorAndWait(page, v.labelLocator, v.value, prevInline);
      await captureHiResForCurrentColor(checkedColor || v.value, newInlineSrc);
      seen.add((checkedColor || v.value).toLowerCase());
    }
  }

  // Colors list to build variant matrix
  const allColorValues = variantDetails.map(v => v.value);
  const hasColors = allColorValues.length > 0;

  // First image per color
  const colorImageMap = new Map();
  for (const img of images) {
    if (!colorImageMap.has(img.color)) colorImageMap.set(img.color, img.image);
  }

  // === Rows ===
  function makeRow({ size, color, isMain }) {
    return {
      Handle: handle,
      Title: isMain ? title : "",
      "Body (HTML)": isMain ? description : "",
      Tags: isMain ? tags : "",
      "Option1 Name": hasSizes ? "Size" : "",
      "Option1 Value": hasSizes ? (size || "") : "",
      "Option2 Name": hasColors ? "Color" : "",
      "Option2 Value": hasColors ? (color || "") : "",
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
