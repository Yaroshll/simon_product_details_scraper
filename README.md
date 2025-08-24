# Simon Product Details Scraper

A robust Node.js web scraper built with Playwright for extracting product details from Simon shopping websites. This scraper is designed to handle complex product pages with multiple variants, colors, and images.

## 🚀 Features

- **Multi-variant Support**: Handles products with size and color variants
- **Image Extraction**: Captures high-resolution product images for each variant
- **Robust Error Handling**: Graceful handling of network issues and missing elements
- **CSV Export**: Exports data in Shopify-compatible CSV format
- **Debug Logging**: Comprehensive logging for troubleshooting
- **Rate Limiting**: Built-in delays to be respectful to target servers

## 📁 Project Structure

```
simon_product_details_scraper/
├── src/
│   ├── helpers/
│   │   ├── browser.js      # Browser management and configuration
│   │   ├── extractors.js   # Core data extraction logic
│   │   ├── excelWriter.js  # CSV export functionality
│   │   └── formatter.js    # Data formatting utilities
│   └── index.js           # Main application entry point
├── output/                # Generated CSV and debug files
├── package.json
└── README.md
```

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd simon_product_details_scraper
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

## 🎯 Usage

### Basic Usage

1. **Configure URLs**: Edit the `PRODUCT_URLS` array in `src/index.js`:

```javascript
const PRODUCT_URLS = [
  {
    url: "https://shop.simon.com/products/your-product-url",
    tags: "your-tags",
    brand: "Brand Name",
    typeitem: "Product Type",
  },
  // Add more URLs as needed
];
```

2. **Run the scraper**:
   ```bash
   npm start
   ```

### Advanced Usage

You can also use the scraper programmatically:

```javascript
import { main } from './src/index.js';

// Run the complete scraping process
await main();
```

## 📊 Output Format

The scraper generates a CSV file with the following columns:

| Column | Description |
|--------|-------------|
| Handle | Product handle/slug |
| Title | Product title |
| Body (HTML) | Product description |
| Tags | Product tags |
| Option1 Name | Size option name |
| Option1 Value | Size value |
| Option2 Name | Color option name |
| Option2 Value | Color value |
| Variant Price | Calculated variant price |
| Cost per item | Calculated cost |
| Image Src | Product image URL |
| product.metafields.custom.original_prodect_url | Original product URL |
| Variant Fulfillment Service | Fulfillment service |
| Variant Inventory Policy | Inventory policy |
| Variant Inventory Tracker | Inventory tracker |
| product.metafields.custom.brand | Brand information |
| product.metafields.custom.item_type | Item type |
| Type | Product type |
| Vendor | Vendor name |
| Published | Publication status |

## ⚙️ Configuration

### Browser Configuration (`src/helpers/browser.js`)

```javascript
const BROWSER_CONFIG = {
  LAUNCH_OPTIONS: {
    headless: false,        // Set to true for headless mode
    timeout: 12000,         // Browser launch timeout
    args: [...],            // Chrome arguments
  },
  CONTEXT_OPTIONS: {
    viewport: { width: 1920, height: 1080 },
    userAgent: '...',
  },
};
```

### Extraction Configuration (`src/helpers/extractors.js`)

```javascript
const CONFIG = {
  TIMEOUTS: {
    PAGE_LOAD: 12000,       // Page load timeout
    COLOR_SELECTION: 8000,  // Color selection timeout
    THUMBNAIL_CLICK: 3000,  // Thumbnail click timeout
    COLOR_CLICK: 15000,     // Color click timeout
    WAIT_FOR_COLOR: 7000,   // Wait for color selection
  },
  DELAYS: {
    PAGE_WAIT: 3000,        // Page wait delay
    COLOR_SELECTION: 60,    // Color selection delay
    THUMBNAIL_WAIT: 80,     // Thumbnail wait delay
    HERO_WAIT: 80,          // Hero image wait delay
  },
  IMAGE_SIZE: "1800x1800",  // Target image size
};
```

### Main Application Configuration (`src/index.js`)

```javascript
const CONFIG = {
  BATCH_SIZE: 10,                    // Process URLs in batches
  DELAY_BETWEEN_REQUESTS: 1000,      // Delay between requests (ms)
};
```

## 🔧 Key Components

### 1. Browser Management (`browser.js`)

- **`launchBrowser()`**: Launches Chromium with optimized settings
- **`createBrowserContext()`**: Creates browser context with viewport and user agent
- **`createPage()`**: Creates new page with default timeouts

### 2. Data Extraction (`extractors.js`)

- **`extractProductData()`**: Main extraction function
- **`extractBasicProductInfo()`**: Extracts title, description, price
- **`extractSizeOptions()`**: Extracts size variants
- **`extractColorVariants()`**: Extracts color variants
- **`captureProductImages()`**: Captures images for all variants

### 3. Data Formatting (`formatter.js`)

- **`formatHandleFromUrl()`**: Converts URL to product handle
- **`extractPrice()`**: Extracts price from text
- **`calculatePrices()`**: Calculates cost and variant prices

### 4. File Export (`excelWriter.js`)

- **`saveToCSV()`**: Saves data to CSV file
- **`saveDebugFile()`**: Saves failed URLs for debugging

## 🐛 Error Handling

The scraper includes comprehensive error handling:

- **Network Errors**: Automatic retries and graceful degradation
- **Missing Elements**: Fallback selectors and default values
- **Invalid Data**: Validation and sanitization
- **File System Errors**: Proper error messages and cleanup

## 📝 Logging

The scraper provides detailed logging:

- **Progress Tracking**: Shows current URL and progress
- **Performance Metrics**: Displays extraction time
- **Error Details**: Comprehensive error messages
- **Success Summary**: Final statistics and success rate

## 🚨 Troubleshooting

### Common Issues

1. **Browser Launch Fails**:
   - Ensure Playwright is installed: `npx playwright install chromium`
   - Check system requirements for Chromium

2. **Page Load Timeout**:
   - Increase `PAGE_LOAD` timeout in configuration
   - Check network connectivity

3. **Element Not Found**:
   - Verify CSS selectors are still valid
   - Check if website structure has changed

4. **Memory Issues**:
   - Reduce batch size
   - Enable headless mode
   - Close browser between batches

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=true npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This scraper is for educational and legitimate business purposes only. Please ensure you comply with the target website's terms of service and robots.txt file. Use responsibly and respect rate limits.

## 🔄 Recent Updates

### v2.0.0 - Major Refactor
- **Improved Code Structure**: Better separation of concerns
- **Enhanced Error Handling**: More robust error management
- **Better Documentation**: Comprehensive JSDoc comments
- **Configuration Management**: Centralized configuration constants
- **Performance Optimizations**: Improved browser management
- **Code Readability**: Cleaner, more maintainable code
