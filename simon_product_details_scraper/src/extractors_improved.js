/**
 * Improved product image capture logic that handles three specific cases:
 * Case 1: One Color & One Size → Save all product images
 * Case 2: One Color & Multiple Sizes → Save all product images  
 * Case 3: Multiple Colors & One Size → Save only one image for each unique color
 */

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

/**
 * Enhanced product image capture function that explicitly handles the three cases
 * @param {Page} page - Playwright page object
 * @param {Array} sizeDetails - Size variant details
 * @param {Function} extractColorVariants - Function to extract color variants
 * @param {Function} selectSize - Function to select size
 * @param {Function} clickColorAndResolveVariant - Function to click color and resolve variant
 * @param {Function} captureImagesForNoColors - Function to capture images for no colors
 * @param {Function} captureImagesForSingleColor - Function to capture images for single color
 * @param {Function} captureImagesForMultipleColors - Function to capture images for multiple colors
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
export async function captureProductImagesEnhanced(
  page, 
  sizeDetails, 
  extractColorVariants,
  selectSize,
  clickColorAndResolveVariant,
  captureImagesForNoColors,
  captureImagesForSingleColor,
  captureImagesForMultipleColors
) {
  console.log(`🔍 Starting enhanced image capture with ${sizeDetails.length} sizes`);
  
  // If no sizes, handle color variants only
  if (sizeDetails.length === 0) {
    console.log("📏 No sizes detected, handling color variants only");
    const variantDetails = await extractColorVariants(page);
    console.log(`🎨 Found ${variantDetails.length} color variants`);
    
    if (variantDetails.length === 0) {
      // No colors, no sizes - just capture all available images
      console.log("🖼️ Scenario: No colors, no sizes - capturing all available images");
      return await captureImagesForNoColors(page);
    } else if (variantDetails.length === 1) {
      // One color, no sizes - capture images for the single color
      console.log("🖼️ Scenario: One color, no sizes - capturing images for single color");
      return await captureImagesForSingleColor(page, variantDetails);
    } else {
      // Multiple colors, no sizes - capture one image per color
      console.log("🖼️ Scenario: Multiple colors, no sizes - capturing one image per color");
      return await captureImagesForMultipleColors(page, variantDetails);
    }
  }

  // Get all possible colors from the first size to determine the scenario
  await selectSize(page, sizeDetails[0].labelLocator, sizeDetails[0].value);
  await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
  
  const initialColors = await extractColorVariants(page);
  const allColors = new Set(initialColors.map(c => c.value));
  
  console.log(`🎨 Found ${allColors.size} total colors: ${Array.from(allColors).join(', ')}`);
  console.log(`📏 Found ${sizeDetails.length} total sizes: ${sizeDetails.map(s => s.value).join(', ')}`);

  // Determine which case we're dealing with
  if (allColors.size === 1 && sizeDetails.length === 1) {
    // Case 1: One Color & One Size → Save all product images
    console.log("🎯 Case 1: One Color & One Size → Saving all product images");
    return await handleOneColorOneSize(page, sizeDetails[0], Array.from(allColors)[0], selectSize, captureImagesForSingleColor);
  } else if (allColors.size === 1 && sizeDetails.length > 1) {
    // Case 2: One Color & Multiple Sizes → Save all product images
    console.log("🎯 Case 2: One Color & Multiple Sizes → Saving all product images");
    return await handleOneColorMultipleSizes(page, sizeDetails, Array.from(allColors)[0], selectSize, extractColorVariants, clickColorAndResolveVariant);
  } else if (allColors.size > 1 && sizeDetails.length === 1) {
    // Case 3: Multiple Colors & One Size → Save only one image for each unique color
    console.log("🎯 Case 3: Multiple Colors & One Size → Saving one image per unique color");
    return await handleMultipleColorsOneSize(page, sizeDetails[0], initialColors, selectSize, clickColorAndResolveVariant);
  } else {
    // Complex case: Multiple Colors & Multiple Sizes
    console.log("🎯 Complex case: Multiple Colors & Multiple Sizes → Using advanced logic");
    return await handleMultipleColorsMultipleSizes(page, sizeDetails, allColors, selectSize, extractColorVariants, clickColorAndResolveVariant);
  }
}

/**
 * Case 1: One Color & One Size → Save all product images
 * @param {Page} page - Playwright page object
 * @param {Object} sizeDetail - Size variant detail
 * @param {string} color - Color value
 * @param {Function} selectSize - Function to select size
 * @param {Function} captureImagesForSingleColor - Function to capture images for single color
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function handleOneColorOneSize(page, sizeDetail, color, selectSize, captureImagesForSingleColor) {
  console.log(`📏 Processing size: ${sizeDetail.value} with color: ${color}`);
  
  try {
    await selectSize(page, sizeDetail.labelLocator, sizeDetail.value);
    await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
    
    // Capture all available images for this color/size combination
    const images = await captureImagesForSingleColor(page, [{ value: color, labelLocator: null }]);
    console.log(`✅ Successfully captured ${images.length} images for one color and one size`);
    return images;
  } catch (error) {
    console.warn(`❌ Failed to capture images for one color and one size:`, error.message);
    return [];
  }
}

/**
 * Case 2: One Color & Multiple Sizes → Save all product images
 * @param {Page} page - Playwright page object
 * @param {Array} sizeDetails - Size variant details
 * @param {string} color - Color value
 * @param {Function} selectSize - Function to select size
 * @param {Function} extractColorVariants - Function to extract color variants
 * @param {Function} clickColorAndResolveVariant - Function to click color and resolve variant
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function handleOneColorMultipleSizes(page, sizeDetails, color, selectSize, extractColorVariants, clickColorAndResolveVariant) {
  console.log(`📏 Processing ${sizeDetails.length} sizes with one color: ${color}`);
  const images = [];
  
  for (const sizeDetail of sizeDetails) {
    try {
      console.log(`📏 Processing size: ${sizeDetail.value}`);
      await selectSize(page, sizeDetail.labelLocator, sizeDetail.value);
      await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
      
      const colorDetails = await extractColorVariants(page);
      if (colorDetails.length > 0) {
        const { checkedColor, image } = await clickColorAndResolveVariant(
          page,
          colorDetails[0].labelLocator,
          colorDetails[0].value
        );
        
        if (image) {
          images.push({ color: checkedColor, image });
          console.log(`✅ Captured image for size ${sizeDetail.value}`);
        } else {
          console.warn(`⚠️ No image captured for size ${sizeDetail.value}`);
        }
      } else {
        console.warn(`⚠️ No color details found for size ${sizeDetail.value}`);
      }
    } catch (error) {
      console.warn(`❌ Failed to capture image for size ${sizeDetail.value}:`, error.message);
      continue;
    }
  }
  
  if (images.length > 0) {
    console.log(`🎉 Successfully captured ${images.length} images for one color with multiple sizes`);
    return images;
  } else {
    console.warn("⚠️ No images captured for one color with multiple sizes");
    return [];
  }
}

/**
 * Case 3: Multiple Colors & One Size → Save only one image for each unique color
 * @param {Page} page - Playwright page object
 * @param {Object} sizeDetail - Size variant detail
 * @param {Array} colorDetails - Color variant details
 * @param {Function} selectSize - Function to select size
 * @param {Function} clickColorAndResolveVariant - Function to click color and resolve variant
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function handleMultipleColorsOneSize(page, sizeDetail, colorDetails, selectSize, clickColorAndResolveVariant) {
  console.log(`📏 Processing one size: ${sizeDetail.value} with ${colorDetails.length} colors`);
  const images = [];
  
  try {
    await selectSize(page, sizeDetail.labelLocator, sizeDetail.value);
    await page.waitForTimeout(CONFIG.DELAYS.BEFORE_EXTRACTION);
    
    // Capture one image per color
    for (const colorDetail of colorDetails) {
      try {
        console.log(`🎨 Processing color: ${colorDetail.value}`);
        const { checkedColor, image } = await clickColorAndResolveVariant(
          page,
          colorDetail.labelLocator,
          colorDetail.value
        );
        
        if (image) {
          images.push({ color: checkedColor, image });
          console.log(`✅ Captured image for color: ${checkedColor}`);
        } else {
          console.warn(`⚠️ No image captured for color: ${colorDetail.value}`);
        }
      } catch (error) {
        console.warn(`❌ Failed to capture color "${colorDetail.value}":`, error.message);
        continue;
      }
    }
    
    console.log(`🎉 Successfully captured ${images.length} images for multiple colors with one size`);
    return images;
  } catch (error) {
    console.warn(`❌ Failed to process multiple colors with one size:`, error.message);
    return [];
  }
}

/**
 * Complex case: Multiple Colors & Multiple Sizes → Advanced logic
 * @param {Page} page - Playwright page object
 * @param {Array} sizeDetails - Size variant details
 * @param {Set} allColors - Set of all available colors
 * @param {Function} selectSize - Function to select size
 * @param {Function} extractColorVariants - Function to extract color variants
 * @param {Function} clickColorAndResolveVariant - Function to click color and resolve variant
 * @returns {Promise<Array<{color: string, image: string}>>} Image data
 */
async function handleMultipleColorsMultipleSizes(page, sizeDetails, allColors, selectSize, extractColorVariants, clickColorAndResolveVariant) {
  console.log(`🔄 Processing complex case: ${allColors.size} colors with ${sizeDetails.length} sizes`);
  const images = [];
  const capturedColors = new Set();
  const failedColors = new Set();
  
  // Try each size to capture missing colors
  for (const sizeDetail of sizeDetails) {
    console.log(`\n📏 Trying size: ${sizeDetail.value}`);
    
    // Select the size
    await selectSize(page, sizeDetail.labelLocator, sizeDetail.value);
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

/**
 * Utility function to determine the image capture strategy based on colors and sizes
 * @param {number} colorCount - Number of colors
 * @param {number} sizeCount - Number of sizes
 * @returns {string} Strategy description
 */
export function getImageCaptureStrategy(colorCount, sizeCount) {
  if (colorCount === 1 && sizeCount === 1) {
    return "Case 1: One Color & One Size → Save all product images";
  } else if (colorCount === 1 && sizeCount > 1) {
    return "Case 2: One Color & Multiple Sizes → Save all product images";
  } else if (colorCount > 1 && sizeCount === 1) {
    return "Case 3: Multiple Colors & One Size → Save only one image for each unique color";
  } else if (colorCount > 1 && sizeCount > 1) {
    return "Complex: Multiple Colors & Multiple Sizes → Advanced logic";
  } else {
    return "Simple: No variations → Save all available images";
  }
}

/**
 * Summary of the three main cases for image saving
 */
export const IMAGE_SAVING_CASES = {
  CASE_1: {
    description: "One Color & One Size",
    strategy: "Save all product images",
    logic: "When there's only one color variant and one size variant, capture all available product images to provide comprehensive visual representation."
  },
  CASE_2: {
    description: "One Color & Multiple Sizes", 
    strategy: "Save all product images",
    logic: "When there's one color but multiple sizes, capture images for each size to show how the product looks across different size options."
  },
  CASE_3: {
    description: "Multiple Colors & One Size",
    strategy: "Save only one image for each unique color",
    logic: "When there are multiple colors but only one size, capture one representative image per color to avoid redundancy while showing color variations."
  }
};
