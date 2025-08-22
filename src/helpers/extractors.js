import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

/* -------------------- generic helpers -------------------- */
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
// Inject _SIZE (e.g., 1800x1800) before extension, keep query string
function normalizeShopifyImage(raw, size = "1800x1800") {
  if (!raw) return "";
  const url = new URL(toAbsoluteUrl(raw));
  const qs = url.search; // keep ?v=...
  // path like /cdn/shop/files/xxxx.webp
  const p = url.pathname;
  const dot = p.lastIndexOf(".");
  if (dot <= 0) return url.toString(); // nothing to do
  const base = p.slice(0, dot);
  const ext = p.slice(dot); // .jpg / .webp
  // avoid double-size if already there
  const sized = base.replace(/_(\d+x\d+)$/, "");
  url.pathname = `${sized}_${size}${ext}`;
  return url.toString().replace(qs, "") + qs;
}

/* -------------------- hero readers (kept for fallback/zoom) -------------------- */
async function readInlineHeroSrc(page) {
  const sel = [
    ".pdp-main-img",
    ".product-main-image img",
    ".product__main-photos img",
    ".product__media-item.is-active img",
    ".slider__slide.is-active img",
  ];
  for (const s of sel) {
    const exists = await page.$(s);
    if (!exists) continue;
    try {
      const src = await page.$eval(s, (img) => {
        const srcset = img.getAttribute("srcset");
        if (srcset) {
          const parts = srcset
            .split(",")
            .map((p) => p.trim().split(" ")[0])
            .filter(Boolean);
          if (parts.length) return parts[parts.length - 1];
        }
        return (
          img.currentSrc ||
          img.getAttribute("data-photoswipe-src") ||
          img.getAttribute("src") ||
          ""
        );
      });
      if (src) return toAbsoluteUrl(src);
    } catch {}
  }
  return "";
}
async function waitForHeroSrcChange(page, prevSrc) {
  const normalize = (s) => toAbsoluteUrl(s || "");
  const prev = normalize(prevSrc);
  for (let i = 0; i < 30; i++) {
    const current = await readInlineHeroSrc(page);
    if (current && normalize(current) !== prev) return current;
    await page.waitForTimeout(80);
  }
  return prev;
}

/* -------------------- zoom (still available, but not required for mapping) -------------------- */
async function openZoomAndGetHiResSrc(page, prevSrc = "") {
  const toAbs = (s) => (s && s.startsWith("//") ? `https:${s}` : s || "");
  const hero = page.locator(".pdp-main-img:visible").first();
  const hasHero = await hero.count().then((c) => c > 0);
  const heroAlt = hasHero
    ? hero
    : page.locator(".product-main-image img:visible, .product__main-photos img:visible").first();

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
    try { await btnHandle.click({ timeout: 2500 }); opened = true; }
    catch { try { await btnHandle.click({ force: true, timeout: 2500 }); opened = true; } catch {} }
  }
  if (!opened) {
    try { await heroAlt.click({ force: true, timeout: 2500 }); opened = true; } catch {}
  }

  try {
    await page.waitForSelector(".pswp__img", { state: "visible", timeout: 2500 });
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
    await page.waitForTimeout(80);
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

/* -------------------- color selection state -------------------- */
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
  } catch { return false; }
}

/* -------------------- variant helpers -------------------- */
async function getCurrentVariantId(page) {
  try {
    const val = await page.$eval('form[action*="/cart/add"] input[name="id"]', (el) => el.value);
    return val ? String(val) : "";
  } catch {
    try {
      const val2 = await page.$eval(
        "[data-product-selected-variant-id]",
        (el) => el.getAttribute("data-product-selected-variant-id")
      );
      return val2 ? String(val2) : "";
    } catch { return ""; }
  }
}

async function getVariantFromAllSources(page, variantId) {
  return await page.evaluate((vid) => {
    function fromObj(obj) {
      if (!obj) return null;
      const variants = obj.variants || (obj.product && obj.product.variants) || [];
      const v = variants?.find((x) => String(x.id) === String(vid));
      return v || null;
    }
    const w = window;
    const candidates = [
      w.productJson, w.ProductJson, w.__INITIAL_STATE__,
      w.ShopifyAnalytics?.meta?.product, w.meta?.product,
      w.product, w.theme?.product,
    ];
    for (const c of candidates) {
      const v = fromObj(c);
      if (v) return v;
    }
    // scan embedded JSON
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]')
    );
    for (const s of scripts) {
      try {
        const obj = JSON.parse(s.textContent || "{}");
        const v = fromObj(obj);
        if (v) return v;
      } catch {}
    }
    return null;
  }, variantId);
}

function variantBestImageUrl(variant) {
  if (!variant) return "";
  // 1) featured_media.preview_image.src
  const fm = variant.featured_media;
  if (fm && fm.preview_image && fm.preview_image.src) return fm.preview_image.src;

  // 2) featured_image.src (Shopify classic)
  if (variant.featured_image && variant.featured_image.src) return variant.featured_image.src;
  if (variant.featured_image && typeof variant.featured_image === "string")
    return variant.featured_image;

  // 3) sometimes media array is on variant/media, rarely:
  if (variant.media && Array.isArray(variant.media) && variant.media.length) {
    const m = variant.media.find((x) => x.preview_image?.src) || variant.media[0];
    if (m?.preview_image?.src) return m.preview_image.src;
    if (m?.src) return m.src;
  }

  return "";
}

/* -------------------- color selection orchestrator -------------------- */
async function selectColorAndWait(page, labelLocator, color, prevInlineSrc) {
  const beforeVariantId = await getCurrentVariantId(page).catch(() => "");

  if (labelLocator) {
    await labelLocator.click({ timeout: 20000 }).catch(async () => {
      const vEsc = cssEscapeValue(color);
      const input = page.locator(
        `input[name="Color"][value="${vEsc}"], ` +
          `input[name="options[Color]"][value="${vEsc}"], ` +
          `input[name="option-0"][value="${vEsc}"], ` +
          `input[type="radio"][value="${vEsc}"]`
      );
      if (await input.count())
        await input.first().click({ force: true, timeout: 20000 });
    });
  }

  await page.waitForTimeout(80);
  await waitForColorSelected(page, color, 8000);

  // wait for variant id to change
  try {
    await page.waitForFunction(
      (oldId) => {
        const el = document.querySelector('form[action*="/cart/add"] input[name="id"]');
        return el && String(el.value) !== String(oldId);
      },
      beforeVariantId,
      { timeout: 2000 }
    );
  } catch {}

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

  let rawTitle = (await page.textContent("h1.product-single__title"))?.trim() || "";
  let rawDesc = (await page.textContent(".pdp-details-txt"))?.trim() || "";
  const title = fixTextEncoding(rawTitle);
  const description = fixTextEncoding(rawDesc);

  const priceText = await page.textContent("span.product__price--compare");
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);

  /* sizes (option1) -> list all, each becomes its own row later */
  const sizeValues = await page.$$eval(
    'fieldset.variant-input-wrap[data-index="option1"] .variant-input[data-index="option1"][data-value], ' +
      'fieldset[data-index="option1"] .variant-input[data-index="option1"][data-value]',
    (nodes) => Array.from(nodes).map((n) => n.getAttribute("data-value")).filter(Boolean)
  );
  const hasSizes = sizeValues.length > 0;

  /* colors */
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
  const images = [];

  /* === KEY FIX: capture image directly from the selected variant object === */
  async function captureForColor(color) {
    const variantId = await getCurrentVariantId(page);
    const variant = await getVariantFromAllSources(page, variantId);
    let src = variantBestImageUrl(variant);

    // normalize to 1800x1800 (keeps ?v=)
    src = normalizeShopifyImage(src, "1800x1800");
    src = toAbsoluteUrl(src);

    // If variant did not expose an image (rare), fallback to current hero/zoom
    if (!src) {
      const hero = await readInlineHeroSrc(page);
      const hasZoom = await page
        .locator("button.js-photoswipe__zoom, button.product__photo-zoom")
        .count();
      const zoom = hasZoom ? await openZoomAndGetHiResSrc(page, hero) : "";
      src = normalizeShopifyImage(zoom || hero || "", "1800x1800");
    }

    images.push({ handle, image: src, color });
  }

  /* === image capture scenarios === */
  if (variantDetails.length === 0) {
    // no colors: just capture hero once
    const hero = await readInlineHeroSrc(page);
    const hasZoom = await page
      .locator("button.js-photoswipe__zoom, button.product__photo-zoom")
      .count();
    const zoom = hasZoom ? await openZoomAndGetHiResSrc(page, hero) : "";
    const src = normalizeShopifyImage(zoom || hero || "", "1800x1800");
    images.push({ handle, image: src, color: "" });
  } else if (variantDetails.length === 1) {
    // one color: ensure the currently selected variant dictates the image
    const color = variantDetails[0].value || (await getCheckedColor(page)) || "";
    await captureForColor(color);
  } else {
    // multiple colors: selected first, then each remaining (no repeats)
    const seen = new Set();

    const initialCheckedColor = await getCheckedColor(page);
    const initEntry =
      (initialCheckedColor &&
        variantDetails.find((v) => v.value === initialCheckedColor)) ||
      variantDetails[0];

    if (initEntry?.labelLocator) {
      const { checkedColor } = await selectColorAndWait(
        page, initEntry.labelLocator, initEntry.value, ""
      );
      await captureForColor(checkedColor || initEntry.value);
      seen.add((checkedColor || initEntry.value).toLowerCase());
    }

    for (const v of variantDetails) {
      const key = (v.value || "").toLowerCase();
      if (!key || seen.has(key)) continue;

      const { checkedColor } = await selectColorAndWait(page, v.labelLocator, v.value, "");
      await captureForColor(checkedColor || v.value);
      seen.add((checkedColor || v.value).toLowerCase());
    }
  }

  /* build variant matrix rows (Size × Color) */
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
