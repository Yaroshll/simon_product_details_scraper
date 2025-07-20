import xlsx from "xlsx";
import fs from "fs";
import path from "path";

export function saveToExcel(data) {
  const now = new Date();
  const datePart = now.toISOString().split("T")[0];
  const timePart = now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-"); // replace colon to avoid file system issues

  const filename = `output/simon_products_${datePart}_${timePart}.xlsx`;

  const outputDir = path.dirname(filename);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(data, { skipHeader: false });

  xlsx.utils.book_append_sheet(wb, ws, "Products");
  xlsx.writeFile(wb, filename);

  console.log(`✅ Saved file: ${filename}`);
}
