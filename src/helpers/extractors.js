import {
  formatHandleFromUrl,
  extractPrice,
  calculatePrices,
} from "./formatter.js";

export async function extractProductData(page, urlObj) {
  const { url, tags } = urlObj;
  await page.goto(url, { waitUntil: "load", timeout: 60000 });

  const handle = formatHandleFromUrl(url);

  const title = await page.textContent("h1.product-single__title");
  const priceText = await page.textContent("span.product__price--compare");
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);

  const option1Label = await page.textContent("label.variant__label");
  const option1Name = option1Label.match(/^\s*(\w+)/)?.[1]?.trim() || ""; // Matches first word like "Size"
  const option1Value = option1Label.match(/\((.*?)\)/)?.[1]?.trim() || "";

  const description = await page.textContent(".pdp-details-txt");

  // Assume 'page' and 'handle' are already defined and the page is loaded.

  const images = [];
  const savedImages = new Set();

  // Function to extract image src from srcset
  async function extractMainImageSrc(page) {
    try {
      await page.waitForSelector(".pdp-main-img", {
        state: "visible",
        timeout: 5000,
      });

      const src = await page.$eval(".pdp-main-img", (img) =>
        img.getAttribute("data-photoswipe-src")
      );

      return src;
    } catch (e) {
      console.warn(
        "⚠️ Could not extract main image source after variant change:",
        e.message
      );
      return null;
    }
  }

  // 1. Get all color variant containers
  // We need to re-fetch these each time we iterate if we click.
  // However, for the initial loop, we can fetch once, then re-fetch
  // only the specific element to click. Let's simplify and re-fetch the list
  // within the loop if a click occurred, or simply by mapping properties.

  // First, identify the parent container for color variants
  const colorFieldset = await page.$('fieldset[name="Color"]');
  if (!colorFieldset) {
    console.log(
      "No 'Color' fieldset found on the page. Skipping color image extraction."
    );
    // Handle cases with no color variants, e.g., proceed directly to other extractions or return.
  } else {
    // Get all variant input elements within the fieldset.
    // We will get their data-value and then try to click them.
    const initialVariantInputs = await colorFieldset.$$(".variant-input");
    const variantDetails = [];

    // Map initial details without holding onto stale ElementHandles for clicking
    for (const inputDiv of initialVariantInputs) {
      const value = await inputDiv.getAttribute("data-value");
      const inputElement = await inputDiv.$('input[type="radio"]');
      const isChecked = await inputElement?.evaluate((el) => el.checked);
      const labelElement = await inputDiv.$("label.variant__button-label");

      if (value && labelElement) {
        variantDetails.push({
          value: value,
          isChecked: isChecked,
          labelLocator: page.locator(
            `label.variant__button-label[for="${await labelElement.getAttribute(
              "for"
            )}"]`
          ), // Get a Locator for future clicking
        });
      }
    }

    if (variantDetails.length === 0) {
      console.log("No color variants found within the fieldset.");
    } else if (variantDetails.length === 1) {
      // ✅ Only one color variant — save all images for it from the slick-track
      const color = variantDetails[0].value;
      console.log(
        `Only one color variant found: ${color}. Extracting all images.`
      );

      const mainImages = await page.$$eval(".pdp-main-img", (imgs) =>
        imgs.map((img) => img.getAttribute("data-photoswipe-src"))
      );

      mainImages.forEach((src) => {
        if (src && !savedImages.has(src)) {
          images.push({ handle, image: src, color });
          savedImages.add(src);
        }
      });
    } else {
      // variantDetails.length > 1
      console.log(
        `${variantDetails.length} color variants found. Iterating through them.`
      );

      // Prioritize the currently selected variant first, then others.
      const orderedVariantDetails = variantDetails.sort(
        (a, b) => (b.isChecked ? 1 : 0) - (a.isChecked ? 1 : 0)
      );

      for (const variant of orderedVariantDetails) {
        const color = variant.value;
        const labelLocator = variant.labelLocator; // Use the Locator

        // Check if the variant is already the active one
        // We use a separate check because the `isChecked` from `variantDetails` might be stale
        const currentVariantInput = await page
          .locator(`input[name="Color"][value="${color}"]`)
          .elementHandle();
        const currentlyChecked = await currentVariantInput?.evaluate(
          (el) => el.checked
        );

        if (currentlyChecked) {
          console.log(
            `Color "${color}" is currently selected. Extracting image.`
          );
          const src = await extractMainImageSrc(page);
          if (src && !savedImages.has(src)) {
            images.push({ handle, image: src, color });
            savedImages.add(src);
          }
        } else {
          // This variant is not selected — click its label and save the main image after
          console.log(`Clicking color "${color}"...`);
          try {
            await labelLocator.click({ timeout: 5000 });

            // Wait for the main image to change after clicking the color variant
            const previousSrc = await extractMainImageSrc(page);

            await labelLocator.click({ timeout: 5000 });

            await page
              .waitForFunction(
                (prev) => {
                  const img = document.querySelector(".pdp-main-img");
                  return (
                    img &&
                    !img.getAttribute("data-photoswipe-src")?.includes(prev)
                  );
                },
                previousSrc,
                { timeout: 7000 }
              )
              .catch(() =>
                console.log(
                  `⚠️ Image did not change after clicking color "${color}", trying to extract anyway...`
                )
              );

            console.log(`Clicked "${color}". Extracting image...`);
            const src = await extractMainImageSrc(page);
            console.log(`✅ Extracted image for "${color}": ${src}`);

            if (src && !savedImages.has(src)) {
              images.push({ handle, image: src, color });
              savedImages.add(src);
            } else {
              console.log(`⚠️ Image for "${color}" is duplicate or missing.`);
            }
          } catch (err) {
            console.warn(
              `⚠️ Could not click color "${color}" — skipped. Error: ${err.message}`
            );
          }
        }
      }
    }
  }
  // Collect unique colors with their first image
const colorImageMap = new Map();
images.forEach((img) => {
  if (!colorImageMap.has(img.color)) {
    colorImageMap.set(img.color, img.image);
  }
});
const uniqueColors = [...colorImageMap.keys()];

  console.log(
    `Finished image extraction. Total unique images saved: ${images.length}`
  );
  // 'images' array now contains objects like { handle, image, color }
  // You can now process this 'images' array to save to your desired output.
// ✅ 1. Additional Color Rows (skip the first color in uniqueColors)
const colorRows = uniqueColors.slice(1).map((color) => ({
  Handle: handle,
  Title: "",
  "Body (HTML)": "",
  Tags: "",
  "Option1 Name": "",
  "Option1 Value": "",
  "Option2 Name": "Color",
  "Option2 Value": color,
  "Variant Price": "",
  "Compare At Price": "",
  "Cost per item": "",
  "Image Src": colorImageMap.get(color) || "",
  "product.metafields.custom.original_prodect_url": "",
  "Variant Fulfillment Service": "",
  "Variant Inventory Policy": "",
  "Variant Inventory Tracker": "",
  Type: "",
  Vendor: "",
  Published: "",
}));

// ✅ 2. Extra Images (if you want to add other images like lifestyle shots)
const extraImageRows = images
  .filter((img) => !colorImageMap.has(img.color)) // Normally this is empty in your logic
  .map((img) => ({
    Handle: handle,
    Title: "",
    "Body (HTML)": "",
    Tags: "",
    "Option1 Name": "",
    "Option1 Value": "",
    "Option2 Name": "",
    "Option2 Value": "",
    "Variant Price": "",
    "Compare At Price": "",
    "Cost per item": "",
    "Image Src": img.image,
    "product.metafields.custom.original_prodect_url": "",
    "Variant Fulfillment Service": "",
    "Variant Inventory Policy": "",
    "Variant Inventory Tracker": "",
    Type: "",
    Vendor: "",
    Published: "",
  }));

return [mainRow, ...colorRows, ...extraImageRows];
}