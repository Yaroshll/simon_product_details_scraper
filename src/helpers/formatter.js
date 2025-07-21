export function formatHandleFromUrl(url) {
  return url
    .split("?")[0]
    .split("/products/")[1]
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}

export function extractPrice(text) {
  const clean = text.replace(/[^\d.]/g, "");
  return parseFloat(clean) || 0;
}

export function calculatePrices(basePrice) {
  const EXCHANGE_RATE = 3.675;
  const VARIANT_PRICE_RATE = 1.3;
  const cost = basePrice * EXCHANGE_RATE;
  const rawVariantPrice = cost * VARIANT_PRICE_RATE;

  // Round down to nearest integer and add 0.99
  const variantPrice = Math.floor(rawVariantPrice) + 0.99;

  return { cost, variantPrice };
}
