// Configuration constants
const CONFIG = {
  EXCHANGE_RATE: 3.675,
  VARIANT_PRICE_RATE: 1.3,
  PRICE_DECIMAL_PLACES: 2,
};

/**
 * Formats a product handle from a URL
 * Extracts the product slug and converts it to a valid handle format
 * 
 * @param {string} url - The product URL
 * @returns {string} Formatted product handle
 * 
 * @example
 * formatHandleFromUrl("https://shop.simon.com/products/mens-northwood-t-shirt")
 * // Returns: "mens-northwood-t-shirt"
 */
export function formatHandleFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    return url
      .split("?")[0] // Remove query parameters
      .split("/products/")[1] // Extract product slug
      .replace(/[^a-zA-Z0-9]+/g, "-") // Replace non-alphanumeric chars with hyphens
      .toLowerCase(); // Convert to lowercase
  } catch (error) {
    console.warn("Failed to format handle from URL:", url, error.message);
    return '';
  }
}

/**
 * Extracts and parses price from text
 * Removes all non-numeric characters except decimal points
 * 
 * @param {string} text - The text containing the price
 * @returns {number} Extracted price as a number, 0 if invalid
 * 
 * @example
 * extractPrice("$29.99")
 * // Returns: 29.99
 */
export function extractPrice(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  try {
    const cleanText = text.replace(/[^\d.]/g, ""); // Keep only digits and decimal points
    const price = parseFloat(cleanText);
    return isNaN(price) ? 0 : price;
  } catch (error) {
    console.warn("Failed to extract price from text:", text, error.message);
    return 0;
  }
}

/**
 * Calculates cost and variant price based on base price
 * Applies exchange rate and markup calculations
 * 
 * @param {number} basePrice - The base price to calculate from
 * @returns {Object} Object containing cost and variantPrice
 * @returns {number} returns.cost - The calculated cost
 * @returns {number} returns.variantPrice - The calculated variant price
 * 
 * @example
 * calculatePrices(10)
 * // Returns: { cost: 36.75, variantPrice: 47.99 }
 */
export function calculatePrices(basePrice) {
  if (typeof basePrice !== 'number' || basePrice < 0) {
    console.warn("Invalid base price provided:", basePrice);
    return { cost: 0, variantPrice: 0 };
  }

  try {
    // Calculate cost using exchange rate
    const cost = basePrice * CONFIG.EXCHANGE_RATE;
    
    // Calculate raw variant price with markup
    const rawVariantPrice = cost * CONFIG.VARIANT_PRICE_RATE;
    
    // Round down to nearest integer and add 0.99 for psychological pricing
    const variantPrice = Math.floor(rawVariantPrice) + 0.99;

    return { 
      cost: Number(cost.toFixed(CONFIG.PRICE_DECIMAL_PLACES)), 
      variantPrice: Number(variantPrice.toFixed(CONFIG.PRICE_DECIMAL_PLACES)) 
    };
  } catch (error) {
    console.error("Failed to calculate prices:", error.message);
    return { cost: 0, variantPrice: 0 };
  }
}
