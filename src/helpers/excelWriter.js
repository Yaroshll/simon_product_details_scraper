import xlsx from "xlsx";
import fs from "fs";
import path from "path";

export function saveToCSV(data, failedUrls = []) {
  const now = new Date();
  const datePart = now.toISOString().split("T")[0];
  const timePart = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  const filename = `output/simon_products_${datePart}_${timePart}.csv`;
  const debugFilename = `output/failed_products_${datePart}_${timePart}.json`;

  const outputDir = path.dirname(filename);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ✅ Save CSV
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data, { skipHeader: false });
  xlsx.utils.book_append_sheet(wb, ws, "Products");
  xlsx.writeFile(wb, filename, { bookType: "csv" });

  console.log(`✅ Saved CSV file: ${filename}`);

  // ✅ Save debug JSON for failed URLs (if any)
  if (failedUrls.length > 0) {
    fs.writeFileSync(debugFilename, JSON.stringify(failedUrls, null, 2), "utf-8");
    console.warn(`⚠️ Saved debug file with failed URLs: ${debugFilename}`);
  } else {
    console.log(`✅ All URLs extracted successfully — no debug file needed.`);
  }
}
