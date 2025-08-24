import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

// Configuration constants
const CONFIG = {
  TIMEOUTS: {
    PAGE_LOAD: 10000,
    COLOR_SELECTION: 6000,
    THUMBNAIL_CLICK: 2000,
    COLOR_CLICK: 10000,
    WAIT_FOR_COLOR: 5000,
    SIZE_SELECTION: 4000,
    ELEMENT_WAIT: 2000,
  },
  DELAYS: {
    PAGE_WAIT: 2000,
    COLOR_SELECTION: 40,
    THUMBNAIL_WAIT: 50,
    HERO_WAIT: 50,
    SIZE_SELECTION: 60,
    AFTER_CLICK: 100,
    AFTER_NAVIGATION: 500,
    BEFORE_EXTRACTION: 300,
  },
  RETRY_ATTEMPTS: {
    HERO_SRC_CHANGE: 25,
    ELEMENT_WAIT: 10,
  },
  IMAGE_SIZE: "1800x1800",
  EXCHANGE_RATE: 3.675,
  VARIANT_PRICE_RATE: 1.3,
};

// CSS Selectors - centralized for easier maintenance
const SELECTORS = {
  TITLE: "h1.product-single__title",
  DESCRIPTION: ".pdp-details-txt",
  COMPARE_PRICE: "span.product__price--compare",
  COLOR_FIELDSET: 'fieldset[name="Color"]',
  SIZE_OPTIONS: [
    'fieldset.variant-input-wrap[data-index="option1"] .variant-input[data-index="option1"][data-value]',
    'fieldset[data-index="option1"] .variant-input[data-index="option1"][data-value]',
    '.variant-input[data-index="option1"][data-value]',
    'fieldset:not([name="Color"]) .variant-input[data-value]',
  ],
  HERO_IMAGE: `div.product__photos .slick-track .slick-slide[aria-hidden="false"] img`,
  THUMBNAILS: [
    "[data-media-id].product__thumb",
    ".thumbnail-list__item [data-media-id]",
    ".thumbnail-list__item",
    ".product-thumbnails li",
    ".product__thumbnails .thumbnail",
    ".product-gallery__thumbnail",
  ],
  COLOR_RADIOS: [
    'input[name="Color"]:checked',
    'input[name="options[Color]"]:checked',
    'input[name="option-0"]:checked',
    'input[type="radio"][checked]',
  ],
};

/* ==================== UTILITY FUNCTIONS ==================== */

/**
 * Converts relative URLs to absolute URLs
 * @param {string} src - The source URL
 * @returns {string} Absolute URL
 */
function toAbsoluteUrl(src) {
  if (!src) return "";
  return src.startsWith("//") ? `https:${src}` : src;
}

/**
 * Escapes CSS values for use in selectors
 * @param {string} value - The value to escape
 * @returns {string} Escaped value
 */
function cssEscapeValue(value = "") {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Waits for an element to be present on the page
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether element was found
 */
async function waitForElement(page, selector, timeout = CONFIG.TIMEOUTS.ELEMENT_WAIT) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    console.warn(`Element not found: ${selector}`, error.message);
    return false;
  }
}

/**
 * Waits for multiple elements to be present on the page
 * @param {Page} page - Playwright page object
 * @param {Array<string>} selectors - Array of CSS selectors to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether at least one element was found
 */
async function waitForAnyElement(page, selectors, timeout = CONFIG.TIMEOUTS.ELEMENT_WAIT) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / selectors.length });
      return true;
    } catch (error) {
      continue;
    }
  }
  console.warn(`None of the elements found: ${selectors.join(', ')}`);
  return false;
}

/**
 * Fixes common text encoding issues
 * @param {string} text - The text to fix
 * @returns {string} Fixed text
 */
function fixTextEncoding(text = "") {
  return text
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u200B/g, '')
    .replace(/\u2033/g, '"')
    .replace(/\u2022/g, '*');
}

/**
 * Normalizes Shopify image URLs to a specific size
 * @param {string} rawUrl - The raw image URL
 * @param {string} size - The desired size (default: 1800x1800)
 * @returns {string} Normalized image URL
 */
function normalizeShopifyImage(rawUrl, size = CONFIG.IMAGE_SIZE) {
  if (!rawUrl) return "";
  
  try {
    const url = new URL(toAbsoluteUrl(rawUrl));
    const queryString = url.search; // Keep version parameter
    const pathname = url.pathname;
    const dotIndex = pathname.lastIndexOf(".");
    
    if (dotIndex <= 0) return url.toString();
    
    const base = pathname.slice(0, dotIndex).replace(/_(\d+x\d+)$/, "");
    const extension = pathname.slice(dotIndex);
    url.pathname = `${base}_${size}${extension}`;
    
    return url.toString().replace(queryString, "") + queryString;
  } catch (error) {
    console.warn("Failed to normalize image URL:", rawUrl, error.message);
    return rawUrl;
  }
}

/**
 * Extracts the largest image URL from a srcset
 * @param {string} srcset - The srcset attribute value
 * @returns {string} The largest image URL
 */
function pickLargestFromSrcset(srcset) {
  if (!srcset) return "";
  
  try {
    const parts = srcset
      .split(",")
      .map(part => part.trim())
      .map(part => {
        const [url, size] = part.split(" ");
        const width = parseInt(size || "0", 10);
        return { url, width: isNaN(width) ? 0 : width };
      })
      .sort((a, b) => b.width - a.width);
    
    return parts[0]?.url || "";
  } catch (error) {
    console.warn("Failed to parse srcset:", srcset, error.message);
    return "";
  }
}

/* ==================== HERO IMAGE EXTRACTION ==================== */

/**
 * Reads high-resolution hero image from the page
 * @param {Page} page - Playwright page object
 * @returns {Promise<string>} Hero image URL
 */
async function readHiResHero(page) {
  try {
    // Wait for hero image to be present
    const exists = await page.$(SELECTORS.HERO_IMAGE);
    if (!exists) {
      // Try waiting for it to appear
      await page.waitForSelector(SELECTORS.HERO_IMAGE, { timeout: 3000 }).catch(() => {
        console.warn("Hero image not found after waiting");
      });
    }

    const imageData = await page.$eval(SELECTORS.HERO_IMAGE, (img) => {
      const rawData = img.getAttribute("data-photoswipe-src") || "";
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
      const current = img.currentSrc || img.getAttribute("src") || "";
      return { rawData, srcset, current };
    });

    if (imageData.rawData) return toAbsoluteUrl(imageData.rawData);
    
    const fromSrcset = pickLargestFromSrcset(imageData.srcset);
    if (fromSrcset) return toAbsoluteUrl(fromSrcset);
    
    if (imageData.current) return toAbsoluteUrl(imageData.current);
    
    return "";
  } catch (error) {
    console.warn("Failed to read hero image:", error.message);
    return "";
  }
}

/**
 * Gets the current state of image slides (which one is visible)
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array<boolean>>} Array of booleans indicating which slides are visible
 */
async function getImageSlidesState(page) {
  try {
    return await page.evaluate(() => {
      const slides = document.querySelectorAll('div.product__photos .slick-track .slick-slide');
      return Array.from(slides).map(slide => slide.getAttribute('aria-hidden') !== 'true');
    });
  } catch (error) {
    console.warn("Failed to get image slides state:", error.message);
    return [];
  }
}

/**
 * Waits for the image slides state to change after interaction
 * @param {Page} page - Playwright page object
 * @param {Array<boolean>} previousState - Previous state of image slides
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether the state changed
 */
async function waitForImageChange(page, previousState, timeout = 5000) {
  try {
    await page.waitForFunction(
      (expectedPreviousState) => {
        const slides = document.querySelectorAll('div.product__photos .slick-track .slick-slide');
        const currentState = Array.from(slides).map(slide => slide.getAttribute('aria-hidden') !== 'true');
        
        // Check if the state has changed
        if (currentState.length !== expectedPreviousState.length) {
          return true; // Different number of slides means change
        }
        
        // Check if any position has different visibility
        for (let i = 0; i < currentState.length; i++) {
          if (currentState[i] !== expectedPreviousState[i]) {
            return true; // State changed
          }
        }
        
        return false; // No change detected
      },
      previousState,
      { timeout }
    );
    
    console.log("✅ Image change detected");
    return true;
  } catch (error) {
    console.warn("⚠️ Image change detection timeout, throwing error...");
    throw new Error("Image change detection failed: " + error.message);
  }
}

/**
 * Waits for hero image source to change after interaction
 * @param {Page} page - Playwright page object
 * @param {string} previousSrc - Previous image source
 * @param {number} maxAttempts - Maximum retry attempts
 * @param {number} delay - Delay between attempts
 * @returns {Promise<string>} New image source
 */
async function waitForHeroSrcChange(page, previousSrc, maxAttempts = CONFIG.RETRY_ATTEMPTS.HERO_SRC_CHANGE, delay = CONFIG.DELAYS.HERO_WAIT) {
  const normalizeSrc = (src) => toAbsoluteUrl(src || "");
  const previousNormalized = normalizeSrc(previousSrc);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentSrc = await readHiResHero(page);
    if (currentSrc && normalizeSrc(currentSrc) !== previousNormalized) {
      return currentSrc;
    }
    await page.waitForTimeout(delay);
  }
  
  return previousSrc;
}

/* ==================== THUMBNAIL HANDLING ==================== */

/**
 * Gets thumbnail locator for the page
 * @param {Page} page - Playwright page object
 * @returns {Locator} Thumbnail locator
 */
function getThumbnailLocator(page) {
  return page.locator(SELECTORS.THUMBNAILS.join(", "));
}

/**
 * Clicks a thumbnail and waits for hero image to update
 * @param {Page} page - Playwright page object
 * @param {number} index - Thumbnail index
 * @param {string} previousHero - Previous hero image URL
 * @returns {Promise<string>} Updated hero image URL
 */
async function clickThumbnailAndWait(page, index, previousHero) {
  const thumbnails = getThumbnailLocator(page);
  const count = await thumbnails.count();
  
  if (!count) return previousHero;
  
  const thumbnail = thumbnails.nth(index);
  
  try {
    // Wait for thumbnail to be clickable
    await thumbnail.waitFor({ state: 'visible', timeout: CONFIG.TIMEOUTS.THUMBNAIL_CLICK });
    
    // Get the current image state before clicking
    const previousImageState = await getImageSlidesState(page);
    
    await thumbnail.click({ 
      timeout: CONFIG.TIMEOUTS.THUMBNAIL_CLICK, 
      force: true 
    });
    
    // Wait after click
    await page.waitForTimeout(CONFIG.DELAYS.AFTER_CLICK);
    await page.waitForTimeout(CONFIG.DELAYS.THUMBNAIL_WAIT);
    
    // Wait for image change with timeout
    await waitForImageChange(page, previousImageState, 5000);
    
    return await waitForHeroSrcChange(page, previousHero);
     } catch (error) {
     console.warn(`Failed to click thumbnail at index ${index}:`, error.message);
     // If image change detection failed, skip this thumbnail
     if (error.message.includes('Image change detection')) {
       console.log(`⚠️ Skipping thumbnail at index ${index} due to image change detection failure`);
     }
     return previousHero;
   }
}

/* ==================== COLOR SELECTION HELPERS ==================== */

/**
 * Gets the currently checked color from the page
 * @param {Page} page - Playwright page object
 * @returns {Promise<string>} Selected color value
 */
async function getCheckedColor(page) {
  return await page.evaluate((selectors) => {
    // Check radio buttons first
    for (const selector of selectors.radios) {
      const element = document.querySelector(selector);
      if (element?.value) return element.value;
    }
    
    // Check selected labels
    const labels = Array.from(document.querySelectorAll("label"));
    const selectedLabel = labels.find(label => 
      label.classList.contains("is-selected") ||
      label.getAttribute("aria-pressed") === "true" ||
      label.getAttribute("aria-checked") === "true"
    );
    
    if (selectedLabel) {
      const value = selectedLabel.getAttribute("data-value") || selectedLabel.textContent?.trim();
      if (value) return value;
    }
    
    return "";
  }, { radios: SELECTORS.COLOR_RADIOS });
}

/**
 * Waits for a specific color to be selected
 * @param {Page} page - Playwright page object
 * @param {string} color - Color to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether color was selected
 */
async function waitForColorSelected(page, color, timeout = CONFIG.TIMEOUTS.COLOR_SELECTION) {
  const escapedColor = cssEscapeValue(color);
  
  try {
    await page.waitForFunction(
      (colorValue, selectors) => {
        // Check radio buttons
        const radioSelectors = [
          `input[name="Color"][value="${colorValue}"]`,
          `input[name="options[Color]"][value="${colorValue}"]`,
          `input[name="option-0"][value="${colorValue}"]`,
          `input[type="radio"][value="${colorValue}"]`,
        ];
        
        for (const selector of radioSelectors) {
          const element = document.querySelector(selector);
          if (element && (element.checked || element.getAttribute("checked") === "true")) {
            return true;
          }
        }
        
        // Check labels
        const labels = Array.from(document.querySelectorAll("label, [data-value]"));
        for (const label of labels) {
          const value = label.getAttribute("data-value") || 
                       label.getAttribute("data-swatch-value") || 
                       label.textContent?.trim();
          
          if (!value) continue;
          
          if (value.toLowerCase() === colorValue.toLowerCase()) {
            const isSelected = label.classList.contains("is-selected") ||
                             label.classList.contains("active") ||
                             label.classList.contains("selected") ||
                             label.getAttribute("aria-pressed") === "true" ||
                             label.getAttribute("aria-checked") === "true";
            
            if (isSelected) return true;
          }
        }
        
        return false;
      },
      escapedColor,
      { timeout }
    );
    
    return true;
  } catch (error) {
    console.warn(`Color selection timeout for "${color}":`, error.message);
    return false;
  }
}

/**
 * Selects a size and waits for it to be applied
 * @param {Page} page - Playwright page object
 * @param {Locator} labelLocator - Size label locator
 * @param {string} size - Size to select
 */
async function selectSize(page, labelLocator, size) {
  if (labelLocator) {
    try {
      // Wait for the element to be clickable
      await labelLocator.waitFor({ state: 'visible', timeout: CONFIG.TIMEOUTS.SIZE_SELECTION });
      
      // Click the size
      await labelLocator.click({ timeout: CONFIG.TIMEOUTS.COLOR_CLICK });
      console.log(`📏 Selected size: ${size}`);
      
      // Wait after click
      await page.waitForTimeout(CONFIG.DELAYS.AFTER_CLICK);
      
      // Wait for any loading states to complete
      await page.waitForTimeout(500);
      
    } catch (error) {
      console.warn(`Failed to click size label for "${size}":`, error.message);
    }
  }
  
  await page.waitForTimeout(CONFIG.DELAYS.SIZE_SELECTION);
}

/**
 * Selects a color and waits for it to be applied
 * @param {Page} page - Playwright page object
 * @param {Locator} labelLocator - Color label locator
 * @param {string} color - Color to select
 */
async function selectColor(page, labelLocator, color) {
  if (labelLocator) {
    try {
      // Wait for the element to be clickable
      await labelLocator.waitFor({ state: 'visible', timeout: CONFIG.TIMEOUTS.COLOR_SELECTION });
      
      // Click the color
      await labelLocator.click({ timeout: CONFIG.TIMEOUTS.COLOR_CLICK });
      
      // Wait after click
      await page.waitForTimeout(CONFIG.DELAYS.AFTER_CLICK);
      
      // Wait for any loading states to complete
      await page.waitForTimeout(500);
      
    } catch (error) {
      console.warn("Failed to click color label, trying radio button:", error.message);
      
      // Fallback to radio button click
      const escapedColor = cssEscapeValue(color);
      const radioSelectors = [
        `input[name="Color"][value="${escapedColor}"]`,
        `input[name="options[Color]"][value="${escapedColor}"]`,
        `input[name="option-0"][value="${escapedColor}"]`,
        `input[type="radio"][value="${escapedColor}"]`,
      ];
      
      const input = page.locator(radioSelectors.join(", "));
      if (await input.count()) {
        await input.first().click({ force: true, timeout: CONFIG.TIMEOUTS.COLOR_CLICK });
        await page.waitForTimeout(CONFIG.DELAYS.AFTER_CLICK);
      }
    }
  }
  
  await page.waitForTimeout(CONFIG.DELAYS.COLOR_SELECTION);
  await waitForColorSelected(page, color, CONFIG.TIMEOUTS.WAIT_FOR_COLOR);
}

/**
 * Clicks a color and resolves the variant
 * @param {Page} page - Playwright page object
 * @param {Locator} labelLocator - Color label locator
 * @param {string} color - Color to select
 * @returns {Promise<{checkedColor: string, image: string}>} Variant data
 */
async function clickColorAndResolveVariant(page, labelLocator, color) {
  // Get the current image state before clicking
  const previousImageState = await getImageSlidesState(page);
  
  await selectColor(page, labelLocator, color);
  
  // Wait for image change with timeout
  await waitForImageChange(page, previousImageState, 5000);
  
  const heroImage = await readHiResHero(page);
  const checkedColor = (await getCheckedColor(page)) || color;
  
  return { checkedColor, image: heroImage };
}

/* ==================== DATA EXTRACTION ==================== */

/**
 * Extracts basic product information from the page
 * @param {Page} page - Playwright page object
 * @param {string} url - Product URL
 * @returns {Promise<{handle: string, title: string, description: string, price: number, cost: number, variantPrice: number}>}
 */
async function extractBasicProductInfo(page, url) {
  const handle = formatHandleFromUrl(url);
  
  const rawTitle = (await page.textContent(SELECTORS.TITLE))?.trim() || "";
  const rawDescription = (await page.textContent(SELECTORS.DESCRIPTION))?.trim() || "";
  
  const title = fixTextEncoding(rawTitle);
  const description = fixTextEncoding(rawDescription);
  
  const priceText = await page.textContent(SELECTORS.COMPARE_PRICE);
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);
  
  return {
    handle,
    title,
    description,
    price,
    cost,
    variantPrice,
  };
}

/**
 * Extracts size options with their clickable elements from the page
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array<{value: string, labelLocator: Locator}>>} Array of size details
 */
async function extractSizeOptions(page) {
  try {
    const sizeDetails = await page.$$eval(
      SELECTORS.SIZE_OPTIONS.join(", "),
      (nodes) => Array.from(nodes)
        .map(node => {
          const value = node.getAttribute("data-value");
          const labelElement = node.querySelector("label.variant__button-label");
          const labelFor = labelElement?.getAttribute("for");
          return { value, labelFor };
        })
        .filter(item => item.value && item.labelFor)
    );
    
    // Convert to locators
    return sizeDetails.map(({ value, labelFor }) => ({
      value,
      labelLocator: page.locator(`label.variant__button-label[for="${labelFor}"]`)
    }));
  } catch (error) {
    console.warn("Failed to extract size options:", error.message);
    return [];
  }
}

/**
 * Checks if a color variant is available (not disabled)
 * @param {Page} page - Playwright page object
 * @param {string} color - Color value to check
 * @returns {Promise<boolean>} Whether the color is available
 */
async function isColorAvailable(page, color) {
  try {
    const escapedColor = cssEscapeValue(color);
    const colorSelector = `.variant-input[data-value="${escapedColor}"] label.variant__button-label`;
    const colorElement = await page.$(colorSelector);
    
    if (!colorElement) return false;
    
    const isDisabled = await colorElement.evaluate(label => 
      label.classList.contains('disabled') || 
      label.hasAttribute('disabled') ||
      label.style.pointerEvents === 'none'
    );
    
    return !isDisabled;
  } catch (error) {
    console.warn(`Failed to check availability for color "${color}":`, error.message);
    return false;
  }
}

/**
 * Extracts color variant details from the page
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array<{value: string, labelLocator: Locator, isAvailable: boolean}>>} Color variant details
 */
async function extractColorVariants(page) {
  const colorFieldset = await page.$(SELECTORS.COLOR_FIELDSET);
  if (!colorFieldset) return [];
  
  try {
    const variantInputs = await colorFieldset.$$(".variant-input");
    const variantDetails = [];
    
    for (const inputDiv of variantInputs) {
      const value = await inputDiv.getAttribute("data-value");
      const labelElement = await inputDiv.$("label.variant__button-label");
      
      if (value && labelElement) {
        const labelFor = await labelElement.getAttribute("for");
        const labelLocator = labelFor
          ? page.locator(`label.variant__button-label[for="${labelFor}"]`)
          : page.locator(`.variant-input[data-value="${cssEscapeValue(value)}"] .variant__button-label`);
        
        const isAvailable = await isColorAvailable(page, value);
        variantDetails.push({ value, labelLocator, isAvailable });
      }
    }
    
    return variantDetails;
  } catch (error) {
    console.warn("Failed to extract color variants:", error.message);
    return [];
  }
}

/* ==================== IMAGE CAPTURE ==================== */

/**
 * Captures images for products with no color variants
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function captureImagesForNoColors(page) {
  const images = [];
  let heroImage = await readHiResHero(page);
  
  const thumbnails = getThumbnailLocator(page);
  const thumbnailCount = await thumbnails.count();
  
  if (!thumbnailCount) {
    images.push({
      color: "",
      image: normalizeShopifyImage(heroImage, CONFIG.IMAGE_SIZE),
    });
  } else {
    for (let i = 0; i < thumbnailCount; i++) {
      heroImage = await clickThumbnailAndWait(page, i, heroImage);
      images.push({
        color: "",
        image: normalizeShopifyImage(heroImage, CONFIG.IMAGE_SIZE),
      });
    }
  }
  
  return images;
}

/**
 * Captures images for products with single color variant
 * @param {Page} page - Playwright page object
 * @param {Array} variantDetails - Color variant details
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function captureImagesForSingleColor(page, variantDetails) {
  const images = [];
  const color = variantDetails[0].value || (await getCheckedColor(page)) || "";
  let heroImage = await readHiResHero(page);
  
  const thumbnails = getThumbnailLocator(page);
  const thumbnailCount = await thumbnails.count();
  
  if (!thumbnailCount) {
    const { image } = await clickColorAndResolveVariant(
      page,
      variantDetails[0].labelLocator,
      color
    );
    images.push({ color, image });
  } else {
    // Ensure selected variant is resolved first
    const firstVariant = await clickColorAndResolveVariant(
      page,
      variantDetails[0].labelLocator,
      color
    );
    images.push({ color, image: firstVariant.image });
    
    // Capture all thumbnail images
    for (let i = 0; i < thumbnailCount; i++) {
      heroImage = await clickThumbnailAndWait(page, i, heroImage);
      images.push({
        color,
        image: normalizeShopifyImage(heroImage, CONFIG.IMAGE_SIZE),
      });
    }
  }
  
  return images;
}

/**
 * Captures images for products with multiple color variants
 * @param {Page} page - Playwright page object
 * @param {Array} variantDetails - Color variant details
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function captureImagesForMultipleColors(page, variantDetails) {
  const images = [];
  const seenColors = new Set();
  
  for (const variant of variantDetails) {
    const colorKey = (variant.value || "").toLowerCase();
    if (!colorKey || seenColors.has(colorKey)) continue;
    
    const { checkedColor, image } = await clickColorAndResolveVariant(
      page,
      variant.labelLocator,
      variant.value
    );
    
    images.push({ color: checkedColor, image });
    seenColors.add(colorKey);
  }
  
  return images;
}

/**
 * Captures all product images with size-aware color extraction
 * @param {Page} page - Playwright page object
 * @param {Array} sizeDetails - Size variant details
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function captureProductImages(page, sizeDetails) {
  // If no sizes, fall back to original logic
  if (sizeDetails.length === 0) {
    const variantDetails = await extractColorVariants(page);
    if (variantDetails.length === 0) {
      return await captureImagesForNoColors(page);
    } else if (variantDetails.length === 1) {
      return await captureImagesForSingleColor(page, variantDetails);
    } else {
      return await captureImagesForMultipleColors(page, variantDetails);
    }
  }

  const images = [];
  const capturedColors = new Set();
  const allColors = new Set();

  console.log(`🔄 Starting size-aware color extraction with ${sizeDetails.length} sizes`);

  // First, get all possible colors from the first size
  await selectSize(page, sizeDetails[0].labelLocator, sizeDetails[0].value);
  
  // Wait before extracting colors
  await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
  
  const initialColors = await extractColorVariants(page);
  initialColors.forEach(color => allColors.add(color.value));

  console.log(`🎨 Found ${allColors.size} total colors: ${Array.from(allColors).join(', ')}`);

  // Track failed colors to avoid retrying them
  const failedColors = new Set();
  
  // Try each size to capture missing colors
  for (const sizeDetail of sizeDetails) {
    console.log(`\n📏 Trying size: ${sizeDetail.value}`);
    
    // Select the size
    await selectSize(page, sizeDetail.labelLocator, sizeDetail.value);
    
    // Wait before extracting colors for this size
    await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
    
    // Get available colors for this size
    const availableColors = await extractColorVariants(page);
    const availableColorValues = availableColors.filter(c => c.isAvailable).map(c => c.value);
    
    console.log(`✅ Available colors for ${sizeDetail.value}: ${availableColorValues.join(', ')}`);
    
    // Try to capture images for colors we haven't captured yet and haven't failed
    for (const colorDetail of availableColors) {
      const { value: color, labelLocator, isAvailable } = colorDetail;
      
      if (!isAvailable) {
        console.log(`❌ Color "${color}" is not available for size "${sizeDetail.value}"`);
        continue;
      }
      
      if (capturedColors.has(color)) {
        console.log(`✅ Color "${color}" already captured, skipping`);
        continue;
      }
      
      if (failedColors.has(color)) {
        console.log(`❌ Color "${color}" previously failed, skipping`);
        continue;
      }
      
      try {
        console.log(`🎨 Attempting to capture color: ${color}`);
        const { checkedColor, image } = await clickColorAndResolveVariant(page, labelLocator, color);
        
        if (image) {
          images.push({ color: checkedColor, image });
          capturedColors.add(color);
          console.log(`✅ Successfully captured color: ${checkedColor}`);
        } else {
          console.log(`⚠️ No image found for color: ${color}, marking as failed`);
          failedColors.add(color);
        }
      } catch (error) {
        console.warn(`❌ Failed to capture color "${color}":`, error.message);
        failedColors.add(color);
        // If image change detection failed, skip this color
        if (error.message.includes('Image change detection')) {
          console.log(`⚠️ Skipping color "${color}" due to image change detection failure`);
        }
      }
    }
    
    // Check if we've processed all possible colors (captured + failed = total)
    const processedColors = capturedColors.size + failedColors.size;
    if (processedColors === allColors.size) {
      console.log(`🎉 All colors processed! Captured: ${capturedColors.size}, Failed: ${failedColors.size}. Stopping at size: ${sizeDetail.value}`);
      break;
    }
  }

  console.log(`📊 Final result: Captured ${capturedColors.size}/${allColors.size} colors`);
  console.log(`📸 Total images captured: ${images.length}`);
  
  if (failedColors.size > 0) {
    console.log(`❌ Failed colors (will not appear in CSV): ${Array.from(failedColors).join(', ')}`);
  }
  
  if (capturedColors.size > 0) {
    console.log(`✅ Successful colors (will appear in CSV): ${Array.from(capturedColors).join(', ')}`);
  }

  return images;
}

/* ==================== DATA TRANSFORMATION ==================== */

/**
 * Creates a color-to-image mapping
 * @param {Array<{color: string, image: string}>} images - Image data
 * @returns {Map<string, string>} Color to image mapping
 */
function createColorImageMap(images) {
  const colorImageMap = new Map();
  
  for (const { color, image } of images) {
    if (!colorImageMap.has(color)) {
      colorImageMap.set(color, image);
    }
  }
  
  return colorImageMap;
}

/**
 * Creates a product row for CSV export
 * @param {Object} params - Row creation parameters
 * @returns {Object} Product row data
 */
function createProductRow({
  handle,
  title,
  description,
  tags,
  size,
  color,
  hasSizes,
  hasColors,
  variantPrice,
  cost,
  colorImageMap,
  images,
  url,
  brand,
  typeitem,
  isMain,
}) {
  return {
    Handle: handle,
    Title: isMain ? title : "",
    "Body (HTML)": isMain ? description : "",
    Tags: isMain ? tags : "",
    "Option1 Name": hasSizes && isMain ? "Size" : "",
    "Option1 Value": hasSizes ? size || "" : "",
    "Option2 Name": hasColors && isMain ? "Color" : "",
    "Option2 Value": hasColors ? color || "" : "",
    "Variant Price": variantPrice.toFixed(2),
    "Cost per item": cost.toFixed(2),
    "Image Src": hasColors
      ? colorImageMap.get(color) || ""
      : images[0]?.image || "",
    "product.metafields.custom.original_prodect_url": isMain ? url : "",
    "Variant Fulfillment Service": "manual",
    "Variant Inventory Policy": "deny",
    "Variant Inventory Tracker": "shopify",
    "product.metafields.custom.brand": isMain ? brand || "" : "",
    "product.metafields.custom.item_type": isMain ? typeitem || "" : "",
    Type: isMain ? "USA Products" : "",
    Vendor: isMain ? "simon" : "",
    Published: isMain ? "TRUE" : "",
  };
}

/**
 * Generates all product rows based on variants
 * @param {Object} params - Product data and configuration
 * @returns {Array<Object>} Array of product rows
 */
function generateProductRows({
  handle,
  title,
  description,
  tags,
  sizeDetails,
  colorValues,
  variantPrice,
  cost,
  colorImageMap,
  images,
  url,
  brand,
  typeitem,
}) {
  const hasSizes = sizeDetails.length > 0;
  const hasColors = colorValues.length > 0;
  const rows = [];
  
  const createRow = (size, color, isMain) => createProductRow({
    handle,
    title,
    description,
    tags,
    size,
    color,
    hasSizes,
    hasColors,
    variantPrice,
    cost,
    colorImageMap,
    images,
    url,
    brand,
    typeitem,
    isMain,
  });
  
  if (hasSizes && hasColors) {
    let isFirst = true;
    for (const sizeDetail of sizeDetails) {
      for (const color of colorValues) {
        rows.push(createRow(sizeDetail.value, color, isFirst));
        isFirst = false;
      }
    }
  } else if (hasSizes && !hasColors) {
    let isFirst = true;
    for (const sizeDetail of sizeDetails) {
      rows.push(createRow(sizeDetail.value, "", isFirst));
      isFirst = false;
    }
  } else if (!hasSizes && hasColors) {
    let isFirst = true;
    for (const color of colorValues) {
      rows.push(createRow("", color, isFirst));
      isFirst = false;
    }
  } else {
    rows.push(createRow("", "", true));
  }
  
  return rows;
}

/* ==================== MAIN EXTRACTION FUNCTION ==================== */

/**
 * Extracts complete product data from a Shopify product page
 * @param {Page} page - Playwright page object
 * @param {Object} urlObj - URL object containing url, tags, brand, typeitem
 * @returns {Promise<Array<Object>>} Array of product rows for CSV export
 */
export async function extractProductData(page, urlObj) {
  const { url, tags, brand, typeitem } = urlObj;
  
  try {
    // Navigate to the product page
    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: CONFIG.TIMEOUTS.PAGE_LOAD 
    });
    await page.waitForTimeout(CONFIG.DELAYS.PAGE_WAIT);
    
    // Wait for page to be fully loaded
    // await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {
    //   console.log("⚠️ Network idle timeout, continuing anyway...");
    // });
    
    // Wait for key elements to be present
    await waitForAnyElement(page, [SELECTORS.TITLE, SELECTORS.DESCRIPTION], 5000);
    await page.waitForTimeout(CONFIG.DELAYS.AFTER_NAVIGATION);
    
    // Wait before starting extraction
    await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
    
    // Extract basic product information
    const basicInfo = await extractBasicProductInfo(page, url);
    
    // Wait before extracting variants
    await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
    
    // Extract variant options
    const sizeDetails = await extractSizeOptions(page);
    const initialColorDetails = await extractColorVariants(page);
    
    // Capture product images with size-aware logic
    const images = await captureProductImages(page, sizeDetails);
    const colorImageMap = createColorImageMap(images);
    
    // Only use successfully captured colors for the CSV
    const successfulColorValues = Array.from(colorImageMap.keys());
    
    // Generate product rows
    const rows = generateProductRows({
      ...basicInfo,
      tags,
      sizeDetails,
      colorValues: successfulColorValues,
      colorImageMap,
      images,
      url,
      brand,
      typeitem,
    });
    
    console.log("✅ Product data extraction completed successfully");
    return rows;
    
  } catch (error) {
    console.error("❌ Failed to extract product data:", error.message);
    throw error;
  }
}
