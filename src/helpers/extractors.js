/**
 * Helper: capture every visible thumbnail as images for the CURRENT state
 * (i.e., after you've selected the intended size/color).
 * Returns normalized URLs, preserving Shopify v= query.
 */
async function captureAllThumbnailsForCurrentState(page) {
  const images = [];
  let heroImage = await readHiResHero(page);

  const thumbnails = getThumbnailLocator(page);
  const count = await thumbnails.count();

  if (!count) {
    if (heroImage) images.push(normalizeShopifyImage(heroImage, CONFIG.IMAGE_SIZE));
    return images;
  }

  for (let i = 0; i < count; i++) {
    heroImage = await clickThumbnailAndWait(page, i, heroImage);
    if (heroImage) {
      images.push(normalizeShopifyImage(heroImage, CONFIG.IMAGE_SIZE));
    }
  }
  return images;
}

/**
 * Captures product images according to the 3 rules:
 * Case 1: One Color & One Size          → Save ALL product images.
 * Case 2: One Color & Multiple Sizes    → Save ALL product images.
 * Case 3: Multiple Colors & One Size    → Save ONE image per unique color.
 * (Other combos fall back to previous “best effort” behavior.)
 */
async function captureProductImages(page, sizeDetails) {
  // Read current color variants once we’re on some base state
  const initialColors = await extractColorVariants(page);
  const availableInitialColors = initialColors.filter(c => c.isAvailable);
  const uniqueColors = [...new Set(availableInitialColors.map(c => c.value))];
  const sizesCount = sizeDetails.length;
  const colorsCount = uniqueColors.length;

  // If there are NO sizes at all, keep your previous logic (works well):
  if (sizesCount === 0) {
    if (colorsCount === 0) {
      return await captureImagesForNoColors(page);
    }
    if (colorsCount === 1) {
      return await captureImagesForSingleColor(page, availableInitialColors);
    }
    // colorsCount > 1
    return await captureImagesForMultipleColors(page, availableInitialColors);
  }

  // We have sizes (>=1). Handle your 3 explicit cases:

  // ===== Case 1 & Case 2: exactly ONE color overall, any number of sizes → save ALL product images
  if (colorsCount === 1) {
    const onlyColor = uniqueColors[0];

    // Pick a representative size (first available) and select it
    const baseSize = sizeDetails[0];
    await selectSize(page, baseSize.labelLocator, baseSize.value);

    // Ensure that color is selected (use the variant object if we have it)
    const colorDetail =
      availableInitialColors.find(c => c.value === onlyColor) || availableInitialColors[0];
    const { checkedColor } = await clickColorAndResolveVariant(page, colorDetail.labelLocator, onlyColor);

    // Now capture ALL thumbnails for this (size,color) state
    const thumbs = await captureAllThumbnailsForCurrentState(page);
    return thumbs.map(img => ({ color: checkedColor, image: img }));
  }

  // ===== Case 3: Multiple colors & ONE size → ONE image per unique color
  if (colorsCount > 1 && sizesCount === 1) {
    const images = [];
    const seen = new Set();

    // Ensure the single size is active
    const theOnlySize = sizeDetails[0];
    await selectSize(page, theOnlySize.labelLocator, theOnlySize.value);

    // For each color, select it, wait for the hero change, then take ONE hero image
    for (const colorDetail of availableInitialColors) {
      const color = colorDetail.value;
      if (!color || seen.has(color.toLowerCase())) continue;

      const { checkedColor, image } = await clickColorAndResolveVariant(
        page,
        colorDetail.labelLocator,
        color
      );
      if (image) {
        images.push({ color: checkedColor, image: normalizeShopifyImage(image, CONFIG.IMAGE_SIZE) });
        seen.add(color.toLowerCase());
      }
    }
    return images;
  }

  // ===== Other combinations (e.g., multiple colors & multiple sizes)
  // Fall back to your previous “size-aware” pass:
  // (Tries sizes to unlock colors; saves a single hero per color.)
  const images = [];
  const captured = new Set();

  // Try each size; when a color becomes available and not yet captured, save ONE hero
  for (const sizeDetail of sizeDetails) {
    await selectSize(page, sizeDetail.labelLocator, sizeDetail.value);
    await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);

    const colorsNow = await extractColorVariants(page);
    for (const c of colorsNow) {
      if (!c.isAvailable) continue;
      const key = (c.value || "").toLowerCase();
      if (!key || captured.has(key)) continue;

      try {
        const { checkedColor, image } = await clickColorAndResolveVariant(page, c.labelLocator, c.value);
        if (image) {
          images.push({ color: checkedColor, image: normalizeShopifyImage(image, CONFIG.IMAGE_SIZE) });
          captured.add(key);
        }
      } catch (e) {
        console.warn(`Failed capturing color "${c.value}" on size "${sizeDetail.value}":`, e.message);
      }
    }

    // Stop early if we got them all
    if (captured.size >= colorsCount) break;
  }

  return images;
}
