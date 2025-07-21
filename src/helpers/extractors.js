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
  const option1Name = option1Label.match(/^\s*(\w+)/)?.[1]?.trim() || "";
  const option1Value = option1Label.match(/\((.*?)\)/)?.[1]?.trim() || "";

  const description = await page.textContent(".pdp-details-txt");

  const images = [];
  const savedImages = new Set();

  // ✅ Corrected image extractor function
  async function extractMainImageSrc(page) {
    try {
      await page.waitForSelector(".pdp-main-img", {
        state: "visible",
        timeout: 5000,
      });
      const src = await page.$eval(".pdp-main-img", (img) =>
        img.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]
      );
      return src;
    } catch (e) {
      console.warn("⚠️ Could not extract main image:", e.message);
      return null;
    }
  }

  const colorFieldset = await page.$('fieldset[name="Color"]');
  if (!colorFieldset) {
    console.log("No 'Color' fieldset found. Skipping color image extraction.");
  } else {
    const initialVariantInputs = await colorFieldset.$$(".variant-input");
    const variantDetails = [];

    for (const inputDiv of initialVariantInputs) {
      const value = await inputDiv.getAttribute("data-value");
      const inputElement = await inputDiv.$('input[type="radio"]');
      const isChecked = await inputElement?.evaluate((el) => el.checked);
      const labelElement = await inputDiv.$("label.variant__button-label");

      if (value && labelElement) {
        variantDetails.push({
          value,
          isChecked,
          labelLocator: page.locator(
            `label.variant__button-label[for="${await labelElement.getAttribute(
              "for"
            )}"]`
          ),
        });
      }
    }

    if (variantDetails.length === 0) {
      console.log("No color variants found.");
    } else if (variantDetails.length === 1) {
      const color = variantDetails[0].value;
      console.log(`Only one color variant: ${color}. Extracting all images.`);

      const srcsets = await page.$$eval(".pdp-main-img", (imgs) =>
        imgs.map((img) => img.getAttribute("srcset"))
      );

      srcsets.forEach((srcset) => {
        const src = srcset?.split(",")[0]?.trim().split(" ")[0];
        if (src && !savedImages.has(src)) {
          images.push({ handle, image: src, color });
          savedImages.add(src);
        }
      });
    } else {
      console.log(`${variantDetails.length} color variants found.`);

      const orderedVariants = variantDetails.sort(
        (a, b) => (b.isChecked ? 1 : 0) - (a.isChecked ? 1 : 0)
      );

      for (const variant of orderedVariants) {
        const color = variant.value;
        const labelLocator = variant.labelLocator;

        const currentInput = await page
          .locator(`input[name="Color"][value="${color}"]`)
          .elementHandle();
        const currentlyChecked = await currentInput?.evaluate(
          (el) => el.checked
        );

        if (currentlyChecked) {
          console.log(`Color "${color}" is selected. Extracting image.`);
          const src = await extractMainImageSrc(page);
          if (src && !savedImages.has(src)) {
            images.push({ handle, image: src, color });
            savedImages.add(src);
          }
        } else {
          console.log(`Clicking color "${color}"...`);
          try {
            const previousSrc = await extractMainImageSrc(page);

            await labelLocator.click({ timeout: 5000 });

            await page
              .waitForFunction(
                (prev) => {
                  const img = document.querySelector(".pdp-main-img");
                  return img && !img.getAttribute("srcset")?.includes(prev);
                },
                previousSrc,
                { timeout: 7000 }
              )
              .catch(() =>
                console.log(
                  `⚠️ Image did not change after clicking color "${color}". Trying anyway.`
                )
              );

            console.log(`Extracting image for color "${color}"...`);
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
              `⚠️ Could not click color "${color}". Skipped. Error: ${err.message}`
            );
          }
        }
      }
    }
  }

  console.log(
    `Finished image extraction. Total unique images: ${images.length}`
  );

  const mainRow = {
    Handle: handle,
    Title: title.trim(),
    "Body (HTML)": description.trim(),
    Tags: tags,
    "Option1 Name": option1Name,
    "Option1 Value": option1Value,
    "Option2 Name": "Color",
    "Option2 Value": images[0]?.color || "",
    "Variant SKU": "",
    "Variant Price": variantPrice.toFixed(2),
    "Compare At Price": price.toFixed(2),
    "Cost per item": cost.toFixed(2),
    "Image Src": images[0]?.image || "",
    "Product URL": url,
  };

  const extraImageRows = images.slice(1).map((img) => ({
    Handle: handle,
    Title: "",
    "Body (HTML)": "",
    Tags: "",
    "Option1 Name": "",
    "Option1 Value": "",
    "Option2 Name": "Color",
    "Option2 Value": img.color,
    "Variant SKU": "",
    "Variant Price": "",
    "Compare At Price": "",
    "Cost per item": "",
    "Image Src": img.image,
    "Product URL": "",
  }));

  return [mainRow, ...extraImageRows];
}
