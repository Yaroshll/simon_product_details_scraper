import xlsx from "xlsx";
import fs from "fs";
import path from "path";

// Configuration constants
const CONFIG = {
  OUTPUT_DIR: "output",
  FILE_NAMES: {
    CSV_PREFIX: "simon_products_",
    DEBUG_PREFIX: "debug_failed_",
  },
  ENCODING: "utf-8",
};

/**
 * Generates a timestamped filename
 * @param {string} prefix - The filename prefix
 * @returns {string} Timestamped filename
 */
function generateTimestampedFilename(prefix) {
  const now = new Date();
  const datePart = now.toISOString().split("T")[0];
  const timePart = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  
  return `${prefix}${datePart}_${timePart}`;
}

/**
 * Ensures the output directory exists
 * @param {string} outputPath - The output file path
 */
function ensureOutputDirectory(outputPath) {
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    } catch (error) {
      console.error("❌ Failed to create output directory:", error.message);
      throw error;
    }
  }
}

/**
 * Saves data to a CSV file
 * @param {Array<Object>} data - The data to save
 * @param {string} filename - The output filename
 */
function saveCSVFile(data, filename) {
  try {
    // Convert data to worksheet
    const worksheet = xlsx.utils.json_to_sheet(data);
    
    // Convert worksheet to CSV
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    
    // Write CSV file
    fs.writeFileSync(filename, csvContent, CONFIG.ENCODING);
    
    console.log(`✅ Saved CSV file: ${filename}`);
    console.log(`📊 Total rows exported: ${data.length}`);
  } catch (error) {
    console.error("❌ Failed to save CSV file:", error.message);
    throw error;
  }
}

/**
 * Saves failed URLs to a debug JSON file
 * @param {Array<Object>} failedUrls - Array of failed URL objects
 * @param {string} filename - The output filename
 */
function saveDebugFile(failedUrls, filename) {
  try {
    const debugData = {
      timestamp: new Date().toISOString(),
      totalFailed: failedUrls.length,
      failedUrls: failedUrls,
    };
    
    fs.writeFileSync(filename, JSON.stringify(debugData, null, 2), CONFIG.ENCODING);
    console.warn(`⚠️ Saved debug file with failed URLs: ${filename}`);
    console.warn(`❌ Total failed URLs: ${failedUrls.length}`);
  } catch (error) {
    console.error("❌ Failed to save debug file:", error.message);
    throw error;
  }
}

/**
 * Saves extracted product data to CSV and optionally saves debug information
 * 
 * @param {Array<Object>} data - Array of product data objects to save
 * @param {Array<Object>} failedUrls - Array of failed URL objects (optional)
 * 
 * @example
 * saveToCSV(productData, failedUrls);
 * // Creates: output/simon_products_2024-01-15_14-30-25.csv
 * // Creates: output/debug_failed_2024-01-15_14-30-25.json (if failedUrls provided)
 */
export function saveToCSV(data, failedUrls = []) {
  if (!Array.isArray(data)) {
    throw new Error("Data must be an array");
  }

  if (data.length === 0) {
    console.warn("⚠️ No data to save. CSV file was not created.");
    return;
  }

  try {
    // Generate filenames
    const timestamp = generateTimestampedFilename("");
    const csvFilename = path.join(
      CONFIG.OUTPUT_DIR, 
      `${CONFIG.FILE_NAMES.CSV_PREFIX}${timestamp}.csv`
    );
    const debugFilename = path.join(
      CONFIG.OUTPUT_DIR, 
      `${CONFIG.FILE_NAMES.DEBUG_PREFIX}${timestamp}.json`
    );

    // Ensure output directory exists
    ensureOutputDirectory(csvFilename);

    // Save CSV file
    saveCSVFile(data, csvFilename);

    // Save debug file if there are failed URLs
    if (failedUrls.length > 0) {
      saveDebugFile(failedUrls, debugFilename);
    } else {
      console.log("✅ All URLs extracted successfully — no debug file needed.");
    }

  } catch (error) {
    console.error("❌ Failed to save data:", error.message);
    throw error;
  }
}
