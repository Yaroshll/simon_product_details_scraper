import xlsx from "xlsx";
import fs from "fs";
import path from "path";
export function saveToCSV(data, failedUrls = []) {
  const now = new Date();
  const datePart = now.toISOString().split("T")[0];
  const timePart = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  const csvFilename = `output/simon_products_${datePart}_${timePart}.csv`;
  const debugFilename = `output/debug_failed_${datePart}_${timePart}.json`;

  const outputDir = path.dirname(csvFilename);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvContent = xlsx.utils.sheet_to_csv(xlsx.utils.json_to_sheet(data));
  fs.writeFileSync(csvFilename, csvContent, "utf-8");
  console.log(`✅ Saved CSV file: ${csvFilename}`);

  if (failedUrls.length > 0) {
    fs.writeFileSync(debugFilename, JSON.stringify(failedUrls, null, 2), "utf-8");
    console.warn(`⚠️ Saved debug file with failed URLs: ${debugFilename}`);
  } else {
    console.log(`✅ All URLs extracted successfully — no debug file needed.`);
  }
}
