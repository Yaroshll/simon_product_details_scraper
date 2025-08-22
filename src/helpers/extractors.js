import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

/* -------------------- small utils -------------------- */
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
// Add _1800x1800 before extension, preserve ?v=
function normalizeShopifyImage(raw, size = "1800x1800") {
  if (!raw) return "";
  const u = new URL(toAbsoluteUrl(raw));
  const qs = u.search; // keep version
  const p = u.pathname;
  const dot = p.lastIndexOf(".");
  if (dot <= 0) return u.toString();
  const base = p.slice(0, dot).replace(/_(\d+x\d+)$/, "");
  const ext = p.slice(dot);
  u.pathname = `${base}_${size}${ext}`;
  return u.toString().replace(qs, "") + qs;
}
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

/* -------------------- hero readers (fallback only) -------------------- */
async function readHiResHero(page) {
  const selectors = [
    'img.photoswipe__image.pdp-main-img',
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
      if (data.rawData) return toAbsoluteUrl(data.rawData);
      const fromSet = pickLargestFromSrcset(data.srcset);
      if (fromSet) return toAbsoluteUrl(fromSet);
      if (data.current) return toAbsoluteUrl(data.current);
    } catch {}
  }
  return "";
}
async function waitForHeroSrcChange(page, prevSrc, tries = 25, delay = 80) {
  const norm = (s) => toAbsoluteUrl(s || "");
  const prev = norm(prevSrc);
  for (let i = 0; i < tries; i++) {
    const cur = await readHiResHero(page);
    if (cur && norm(cur) !== prev) return cur;
    await page.waitForTimeout(delay);
  }
  return prev;
}

/* -------------------- thumbnails (used only for single-color all-images) -------------------- */
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
async function clickThumbnailAndWait(page, idx, prevHero) {
  const thumbs = thumbnailsLocator(page);
  const count = await thumbs.count();
  if (!count) return prevHero;
  const item = thumbs.nth(idx);
  await item.click({ timeout: 3000, force: true }).catch(() => {});
  await page.waitForTimeout(80);
  await page.waitForLoadState("networkidle").catch(() => {});
  return await waitForHeroSrcChange(page, prevHero);
}

/* -------------------- selection helpers -------------------- */
async function getCheckedColor(page) {
  return await page.evaluate(() => {
    const radios = [
      'input[name="Color"]:checked',
      'input[name="options[Color]"]:checked',
      'input[name="option-0"]:checked',
      'input[type="radio"][checked]',
    ];
    for (const r of radios) {
      const el = document.querySelector(r);
      if (el?.value) return el.value;
    }
    const lbl = Array.from(document.querySelectorAll("label")).find(
      (l) =>
        l.classList.contains("is-selected") ||
        l.getAttribute("aria-pressed") === "true" ||
        l.getAttribute("aria-checked") === "true"
    );
    if (lbl) {
      const v = lbl.getAttribute("data-value") || lbl.textContent?.trim();
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
async function selectColor(page, labelLocator, color) {
  if (labelLocator) {
    await labelLocator.click({ timeout: 15000 }).catch(async () => {
      const vEsc = cssEscapeValue(color);
      const input = page.locator(
        `input[name="Color"][value="${vEsc}"], ` +
          `input[name="options[Color]"][value="${vEsc}"], ` +
          `input[name="option-0"][value="${vEsc}"], ` +
          `input[type="radio"][value="${vEsc}"]`
      );
      if (await input.count()) await input.first().click({ force: true, timeout: 15000 });
    });
  }
  await page.waitForTimeout(60);
  await waitForColorSelected(page, color, 7000);
}

/* -------------------- variant resolution (robust) -------------------- */
// 1) direct hidden input
async function getVariantIdFromInput(page) {
  try {
    const val = await page.$eval('form[action*="/cart/add"] input[name="id"]', (el) => el.value);
    return val ? String(val) : "";
  } catch { return ""; }
}
// 2) from URL ?variant=
async function getVariantIdFromUrl(page) {
  try {
    const href = await page.url();
    const u = new URL(href);
    const v = u.searchParams.get("variant");
    return v ? String(v) : "";
  } catch { return ""; }
}
// 3) read selected options on page
async function getSelectedOptions(page) {
  return await page.evaluate(() => {
    const opts = {};
    // radio/label groups
    const radios = Array.from(document.querySelectorAll('input[type="radio"]:checked'));
    for (const r of radios) {
      const name = (r.name || "").trim();
      const val = (r.value || "").trim();
      if (name && val) opts[name] = val;
    }
    // selects
    const selects = Array.from(document.querySelectorAll("select"));
    for (const s of selects) {
      const name = (s.name || s.getAttribute("data-option-name") || s.id || "").trim();
      const val = (s.value || "").trim();
      if (name && val) opts[name] = val;
    }
    return opts; // e.g., { Color: "gold/white/chalk", Size: "One Size" }
  });
}
// 4) get product JSON (multiple sources)
async function getProductJsonCandidates(page) {
  return await page.evaluate(() => {
    const out = [];
    const w = window;
    const candidates = [
      w.productJson, w.ProductJson, w.__INITIAL_STATE__,
      w.ShopifyAnalytics?.meta?.product, w.meta?.product,
      w.product, w.theme?.product,
    ];
    for (const c of candidates) if (c) out.push(c);
    // script tags with JSON
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]')
    );
    for (const s of scripts) {
      try {
        const obj = JSON.parse(s.textContent || "{}");
        out.push(obj);
      } catch {}
    }
    return out;
  });
}
// find variant by id in any candidate
function pickVariantByIdFromCandidates(cands, variantId) {
  for (const obj of cands) {
    const variants = obj?.variants || obj?.product?.variants;
    if (Array.isArray(variants)) {
      const v = variants.find((x) => String(x.id) === String(variantId));
      if (v) return v;
    }
  }
  return null;
}
// find variant by matching selected option values (Color/Size) to variants.options
function pickVariantByOptionsFromCandidates(cands, selectedOpts) {
  const selVals = Object.values(selectedOpts).map((v) => (v || "").toLowerCase());
  for (const obj of cands) {
    const variants = obj?.variants || obj?.product?.variants;
    if (!Array.isArray(variants)) continue;
    // Determine option order labels if present (option1, option2 names)
    const optNames = obj?.options?.map?.((o) => o?.name) || obj?.product?.options?.map?.((o) => o?.name) || [];
    for (const v of variants) {
      // Shopify stores variant.options array in display order
      const vOpts = Array.isArray(v.options) ? v.options.map((x) => (x || "").toLowerCase()) : [];
      // If we have labels, try labeled matching; else fallback to "does every selected value appear in v.options"
      const hits = selVals.every((sv) => vOpts.includes(sv));
      if (hits) return v;
      // also try direct properties (v.option1, v.option2...)
      const v1 = (v.option1 || "").toLowerCase();
      const v2 = (v.option2 || "").toLowerCase();
      const v3 = (v.option3 || "").toLowerCase();
      const flat = [v1, v2, v3].filter(Boolean);
      if (selVals.every((sv) => flat.includes(sv))) return v;
    }
  }
  return null;
}
// choose best image field from variant
function variantBestImageUrl(variant) {
  if (!variant) return "";
  if (variant.featured_media?.preview_image?.src) return variant.featured_media.preview_image.src;
  if (variant.featured_image?.src) return variant.featured_image.src;
  if (typeof variant.featured_image === "string") return variant.featured_image;
  // sometimes there is image on variant.image or image.src
  if (variant.image?.src) return variant.image.src;
  if (typeof variant.image === "string") return variant.image;
  // last resort: product-level images referenced by media_id (not used here)
  return "";
}
// get selected variant robustly
async function getSelectedVariant(page) {
  const cands = await getProductJsonCandidates(page);

  // try by id (hidden input)
  const id1 = await getVariantIdFromInput(page);
  if (id1) {
    const v = pickVariantByIdFromCandidates(cands, id1);
    if (v) return v;
  }
  // try by URL
  const id2 = await getVariantIdFromUrl(page);
  if (id2) {
    const v = pickVariantByIdFromCandidates(cands, id2);
    if (v) return v;
  }
  // try by matching selected options
  const sel = await getSelectedOptions(page);
  const v3 = pickVariantByOptionsFromCandidates(cands, sel);
  if (v3) return v3;

  return null;
}

/* -------------------- click color -------------------- */
async function clickColorAndResolveVariant(page, labelLocator, color) {
  await selectColor(page, labelLocator, color);

  // small settle
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(80);

  // read the selected variant object
  const variant = await getSelectedVariant(page);

  // derive its image URL (normalized to 1800x1800) – THIS is the key fix
  let src = variantBestImageUrl(variant);
  src = normalizeShopifyImage(src, "1800x1800");
  src = toAbsoluteUrl(src);

  // if still nothing, fallback to hero (rare)
  if (!src) {
    const hero = await readHiResHero(page);
    src = normalizeShopifyImage(hero, "1800x1800");
  }

  // determine checked color label (for row)
  const checkedColor = (await getCheckedColor(page)) || color;
  return { checkedColor, image: src };
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

  // sizes (option1) -> collect all values
  const sizeValues = await page.$$eval(
    'fieldset.variant-input-wrap[data-index="option1"] .variant-input[data-index="option1"][data-value], ' +
      'fieldset[data-index="option1"] .variant-input[data-index="option1"][data-value]',
    (nodes) => Array.from(nodes).map((n) => n.getAttribute("data-value")).filter(Boolean)
  );
  const hasSizes = sizeValues.length > 0;

  // colors (fieldset[name="Color"])
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

  const images = []; // {color, image}

  /* === image capture === */
  if (variantDetails.length === 0) {
    // No colors → capture hero (and all thumbs) for empty color
    let hero = await readHiResHero(page);
    const thumbs = thumbnailsLocator(page);
    const tCount = await thumbs.count();
    if (!tCount) {
      images.push({ color: "", image: normalizeShopifyImage(hero, "1800x1800") });
    } else {
      for (let i = 0; i < tCount; i++) {
        hero = await clickThumbnailAndWait(page, i, hero);
        images.push({ color: "", image: normalizeShopifyImage(hero, "1800x1800") });
      }
    }
  } else if (variantDetails.length === 1) {
    // One color → save all gallery images for that color
    const color = variantDetails[0].value || (await getCheckedColor(page)) || "";
    let hero = await readHiResHero(page);
    const thumbs = thumbnailsLocator(page);
    const tCount = await thumbs.count();
    if (!tCount) {
      const { image } = await clickColorAndResolveVariant(page, variantDetails[0].labelLocator, color);
      images.push({ color, image });
    } else {
      // ensure selected variant resolved first for proper mapping; then iterate thumbs
      const first = await clickColorAndResolveVariant(page, variantDetails[0].labelLocator, color);
      images.push({ color, image: first.image });
      for (let i = 0; i < tCount; i++) {
        hero = await clickThumbnailAndWait(page, i, hero);
        images.push({ color, image: normalizeShopifyImage(hero, "1800x1800") });
      }
    }
  } else {
    // Multiple colors → for each color, click & resolve via VARIANT JSON (not the hero)
    const seen = new Set();
    for (const v of variantDetails) {
      const key = (v.value || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      const { checkedColor, image } = await clickColorAndResolveVariant(page, v.labelLocator, v.value);
      images.push({ color: checkedColor, image });
      seen.add(key);
    }
  }

  // First image per color for rows
  const colorImageMap = new Map();
  for (const { color, image } of images) {
    if (!colorImageMap.has(color)) colorImageMap.set(color, image);

  }
  console.log('fg',colorImageMap.get(color));
   console.log('fg',colorImageMap.get(image));


  const allColorValues = variantDetails.map((v) => v.value);
  const hasColors = allColorValues.length > 0;

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
      "Image Src": hasColors ? (colorImageMap.get(color) || "") : ( (images[0]?.image) || "" ),
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
