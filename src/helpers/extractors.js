import { formatHandleFromUrl, extractPrice, calculatePrices } from "./formatter.js";

export async function extractProductData(page, urlObj) {
  const { url, tags } = urlObj;
  await page.goto(url, { waitUntil: "load", timeout: 60000 });

  const handle = formatHandleFromUrl(url);

  const title = await page.textContent('h1.product-single__title');
  const priceText = await page.textContent('span.product__price--compare');
  const price = extractPrice(priceText);
  const { cost, variantPrice } = calculatePrices(price);

  const option1Name = await page.textContent('label.variant__label');
  const option1Value = await page.$eval('label.variant__label', el =>
    el.innerText.split("\n").pop().trim()
  );

  const variantOptions = await page.$$('fieldset[name="Color"] .variant-input');
  const description = await page.textContent('.pdp-details-txt');

  const images = [];

  if (variantOptions.length === 1) {
    const color = await variantOptions[0].getAttribute("data-value");
    const srcsets = await page.$$eval('.slick-track img', imgs =>
      imgs.map(img => img.getAttribute("srcset"))
    );
    srcsets.forEach(srcset => {
      const src = srcset?.split(",")[0]?.trim().split(" ")[0];
      if (src) {
        images.push({ handle, image: src, color });
      }
    });
  } else {
    for (const variant of variantOptions) {
      const color = await variant.getAttribute("data-value");
      const label = await variant.$("label");
      if (label) await label.click();
      await page.waitForTimeout(1000);

      const src = await page.$eval('.slick-track img', img =>
        img.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]
      );

      if (src) {
        images.push({ handle, image: src, color });
      }
    }
  }

  const productRow = {
    Handle: handle,
    Title: title.trim(),
    "Body (HTML)": description.trim(),
    Tags: tags,
    "Option1 Name": option1Name.trim(),
    "Option1 Value": option1Value,
    "Option2 Name": "Color",
    "Option2 Value": images[0]?.color || "",
    "Variant SKU": "",
    "Variant Price": variantPrice.toFixed(2),
    "Compare At Price": price.toFixed(2),
    "Cost per item": cost.toFixed(2),
    "Image Src": images[0]?.image || "",
  };

  const extraImageRows = images.slice(1).map(img => ({
    Handle: handle,
    "Image Src": img.image,
  }));

  return [productRow, ...extraImageRows];
}
