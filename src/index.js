import {
  launchBrowser,
  createBrowserContext,
  createPage,
} from "./helpers/browser.js";
import { extractProductData } from "./helpers/extractors.js";
import { saveToCSV } from "./helpers/excelWriter.js";

// Configuration constants
const CONFIG = {
  BATCH_SIZE: 10, // Process URLs in batches
  DELAY_BETWEEN_REQUESTS: 1000, // 1 second delay between requests
};

// Sample product URLs to scrape
const PRODUCT_URLS = [
        {
          "url": "https://shop.simon.com/products/reiss-rope-wool-textured-waistcoat?crpid=7874065793084",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Reiss",
          "savings": 92,
          "currentPrice": "$15.99",
          "originalPrice": "$210.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-2?crpid=8747484643388",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 90,
          "currentPrice": "$27.99",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-4?crpid=8747489099836",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 90,
          "currentPrice": "$27.99",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt?crpid=8747479662652",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 90,
          "currentPrice": "$27.99",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-1?crpid=8747480481852",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 90,
          "currentPrice": "$27.99",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-3?crpid=8747485626428",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 90,
          "currentPrice": "$27.99",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-cooper-brushed-shirt?crpid=8758960717884",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 89,
          "currentPrice": "$27.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-micro-linen-blend-shirt?crpid=8745108668476",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 89,
          "currentPrice": "$27.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-butler-pinwale-shirt-3?crpid=8771986260028",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 89,
          "currentPrice": "$27.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-cooper-brushed-shirt-1?crpid=8759129112636",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 89,
          "currentPrice": "$27.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-butler-pinwale-shirt-2?crpid=8759236722748",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 89,
          "currentPrice": "$27.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-spring-floral-print-shirt-1?crpid=8732173795388",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 89,
          "currentPrice": "$27.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-linen-blend-shirt-1?crpid=8745136357436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 89,
          "currentPrice": "$27.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-spring-floral-print-shirt-2?crpid=8735826313276",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 88,
          "currentPrice": "$30.99",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-avery-prussian-blue-straight-jean?crpid=8756314603580",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 87,
          "currentPrice": "$27.99",
          "originalPrice": "$208.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-avery-desert-sand-straight-jean?crpid=8732140470332",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 87,
          "currentPrice": "$27.99",
          "originalPrice": "$208.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-ivan-corduroy-pant?crpid=8735774572604",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 87,
          "currentPrice": "$27.99",
          "originalPrice": "$208.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-the-blinder-v-2-cage-skinny-biker-jean?crpid=7280601137212",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 86,
          "currentPrice": "$37.98",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-cooper-cromer-tapered-skinny-jean?crpid=8731913289788",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 86,
          "currentPrice": "$27.99",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-cooper-light-fjord-tapered-skinny-jean?crpid=8755526893628",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 86,
          "currentPrice": "$27.99",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-7?crpid=8817629495356",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 84,
          "currentPrice": "$47.99",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-wool-suit-jacket-8?crpid=7282823168060",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 83,
          "currentPrice": "$102.98",
          "originalPrice": "$595.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-wool-blend-suit-jacket-5?crpid=7337604513852",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 83,
          "currentPrice": "$101.98",
          "originalPrice": "$600.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-wool-blend-suit-jacket-3?crpid=7282822807612",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 82,
          "currentPrice": "$109.98",
          "originalPrice": "$615.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-wool-blend-suit-jacket-4?crpid=7282846433340",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 82,
          "currentPrice": "$107.98",
          "originalPrice": "$600.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/todd-snyder-coaches-jacket?crpid=7800756731964",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "TODD SNYDER",
          "savings": 82,
          "currentPrice": "$107.98",
          "originalPrice": "$598.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-luxe-performance-crewneck-sweater-1?crpid=8817619075132",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 82,
          "currentPrice": "$47.99",
          "originalPrice": "$268.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-russell-belfast-slim-straight-jean?crpid=8614409830460",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 82,
          "currentPrice": "$34.99",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-blend-shirt?crpid=8817626087484",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-linen-blend-dress-shirt-2?crpid=8758556524604",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/simkhai-robbie-short-1?crpid=7960936611900",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SIMKHAI",
          "savings": 81,
          "currentPrice": "$65.99",
          "originalPrice": "$345.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/simkhai-robbie-short?crpid=7960160665660",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SIMKHAI",
          "savings": 81,
          "currentPrice": "$65.99",
          "originalPrice": "$345.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-twill-bengal-dress-shirt-1?crpid=8735844368444",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/simkhai-dean-linen-blend-short?crpid=7960239210556",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SIMKHAI",
          "savings": 81,
          "currentPrice": "$61.99",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-butler-pinwale-shirt-1?crpid=8745121480764",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/burberry-womens-be4430u-55mm-sunglasses-1?crpid=8742613188668",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Burberry",
          "savings": 81,
          "currentPrice": "$99.98",
          "originalPrice": "$522.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-floral-linen-blend-shirt?crpid=8759470620732",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-drawstring-wool-pant-1?crpid=7792502276156",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 81,
          "currentPrice": "$56.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-strawberry-print-shirt?crpid=8745116696636",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-wool-blazer-20?crpid=7792400662588",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 81,
          "currentPrice": "$121.98",
          "originalPrice": "$630.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/boss-hugo-boss-slim-fit-velvet-suit-jacket?crpid=8683675320380",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "BOSS Hugo Boss",
          "savings": 81,
          "currentPrice": "$132.99",
          "originalPrice": "$695.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-dobby-stripe-shirt-1?crpid=8725143355452",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-shirt-1?crpid=8732108914748",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-shirt?crpid=8731987869756",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-geo-check-print-shirt?crpid=8731917615164",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-novelty-cuff-poplin-shirt?crpid=8725176156220",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-linen-blend-dress-shirt?crpid=8758496886844",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-reynolds-novelty-cuff-poplin-shirt-2?crpid=8735827656764",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 81,
          "currentPrice": "$49.98",
          "originalPrice": "$265.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/spyder-podium-1-2-zip-mock-neck-baselayer-pullover-2?crpid=8730805403708",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Spyder",
          "savings": 80,
          "currentPrice": "$27.99",
          "originalPrice": "$139.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-6?crpid=8817628184636",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/burberry-mens-be4439-51mm-sunglasses-1?crpid=8815734816828",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Burberry",
          "savings": 80,
          "currentPrice": "$99.98",
          "originalPrice": "$493.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-tech-raffi-compact-pant?crpid=7871496585276",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 80,
          "currentPrice": "$55.98",
          "originalPrice": "$285.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-solid-linen-shirt?crpid=8745112895548",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-wright-knit-blazer?crpid=8735790628924",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$199.98",
          "originalPrice": "$995.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-pratt-multi-stripe-crewneck-sweater-1?crpid=8735789285436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$69.98",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-linen-shirt-5?crpid=8758937485372",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-linen-shirt?crpid=8745113255996",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-linen-shirt-2?crpid=8745124462652",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-hardy-shirt?crpid=8771950837820",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$49.98",
          "originalPrice": "$245.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-pearce-stretch-knit-shirt?crpid=8725295366204",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-knight-johnny-collar-shirt-1?crpid=8725222424636",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$69.98",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-check-linen-shirt-1?crpid=8745116893244",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-knight-johnny-collar-shirt-3?crpid=8725308932156",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$69.98",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-hardy-plaid-shirt?crpid=8745134948412",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$49.98",
          "originalPrice": "$245.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/reversible-signature-logo-and-leather-belt-2?crpid=8758305783868",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Michael Kors Outlet",
          "savings": 80,
          "currentPrice": "$39.00",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/ted-baker-chino-short?crpid=8705941733436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Ted Baker",
          "savings": 80,
          "currentPrice": "$29.98",
          "originalPrice": "$150.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-butler-stretch-twill-shirt-1?crpid=8731918958652",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$59.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-conway-garment-dyed-wool-hoodie-3?crpid=8732124086332",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$65.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-pratt-multi-stripe-crewneck-sweater?crpid=8730492731452",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 80,
          "currentPrice": "$69.98",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/brodie-cashmere-ribbed-wool-cashmere-blend-1-4-zip-mock-neck-sweater-2?crpid=8735893946428",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Brodie Cashmere",
          "savings": 80,
          "currentPrice": "$87.99",
          "originalPrice": "$435.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-crewneck-sweater-2?crpid=8795973746748",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 79,
          "currentPrice": "$43.99",
          "originalPrice": "$208.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-ashton-slim-peak-jacket-1?crpid=7344623648828",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 79,
          "currentPrice": "$51.98",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/marcus-adler-set-of-2-cloth-neck-gaitors-6?crpid=4644610834492",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Marcus Adler",
          "savings": 79,
          "currentPrice": "$5.98",
          "originalPrice": "$28.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-multi-check-shirt-1?crpid=8745136750652",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 79,
          "currentPrice": "$59.98",
          "originalPrice": "$285.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-multi-check-shirt?crpid=8725129297980",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 79,
          "currentPrice": "$59.98",
          "originalPrice": "$285.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-linen-jersey-polo-shirt?crpid=8745922625596",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 79,
          "currentPrice": "$39.98",
          "originalPrice": "$195.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-morgan-multi-stripe-shirt?crpid=8731922268220",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 79,
          "currentPrice": "$59.98",
          "originalPrice": "$285.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-nested-traveler-tech-suit-jacket-2?crpid=7964210298940",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 79,
          "currentPrice": "$165.99",
          "originalPrice": "$795.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cavalli-class-2pc-slim-fit-wool-suit-4?crpid=7099367358524",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cavalli Class",
          "savings": 79,
          "currentPrice": "$269.98",
          "originalPrice": "$1,295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/john-varvatos-ross-slim-fit-sport-shirt?crpid=8631132160060",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "John Varvatos",
          "savings": 78,
          "currentPrice": "$48.99",
          "originalPrice": "$218.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/joe-s-jeans-overshirt-2?crpid=8819249840188",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "JOE'S Jeans",
          "savings": 78,
          "currentPrice": "$79.99",
          "originalPrice": "$368.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/grayers-heritage-flannel-shirt?crpid=8704125763644",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Grayers",
          "savings": 78,
          "currentPrice": "$27.99",
          "originalPrice": "$125.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vintage-1946-microsuede-overshirt?crpid=8730496401468",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vintage 1946",
          "savings": 78,
          "currentPrice": "$27.99",
          "originalPrice": "$125.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-luxe-performance-crewneck-sweater?crpid=8817618354236",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 78,
          "currentPrice": "$59.98",
          "originalPrice": "$268.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-oliver-short-2?crpid=8793937608764",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 78,
          "currentPrice": "$27.99",
          "originalPrice": "$128.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/slate-stone-zip-bomber-jacket-1?crpid=8736385990716",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Slate & Stone",
          "savings": 78,
          "currentPrice": "$87.99",
          "originalPrice": "$398.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/diesel-glubb-jacket?crpid=7117939703868",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Diesel",
          "savings": 78,
          "currentPrice": "$109.98",
          "originalPrice": "$495.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-relaxed-t-shirt-2?crpid=8819036291132",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 78,
          "currentPrice": "$27.99",
          "originalPrice": "$128.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-rockwell-pinwale-corduroy-pant-2?crpid=8737099022396",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 78,
          "currentPrice": "$69.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vintage-1946-microsuede-overshirt-1?crpid=8732029157436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vintage 1946",
          "savings": 78,
          "currentPrice": "$27.99",
          "originalPrice": "$125.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-rockwell-pinwale-corduroy-pant?crpid=8737032077372",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 78,
          "currentPrice": "$69.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-douglas-chino-pant-2?crpid=8735790825532",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 78,
          "currentPrice": "$69.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-douglas-chino-pant-3?crpid=8735863898172",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 78,
          "currentPrice": "$69.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-douglas-chino-pant-1?crpid=8725221408828",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 78,
          "currentPrice": "$69.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-modern-fit-dress-shirt-5?crpid=7915352653884",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 78,
          "currentPrice": "$27.98",
          "originalPrice": "$125.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/lanvin-clay-leather-mesh-high-top-sneaker-2?crpid=7620253450300",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Lanvin",
          "savings": 78,
          "currentPrice": "$213.98",
          "originalPrice": "$980.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-rockwell-pinwale-corduroy-pant-1?crpid=8737061765180",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 78,
          "currentPrice": "$69.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-wool-blazer-19?crpid=7792356130876",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 78,
          "currentPrice": "$139.99",
          "originalPrice": "$645.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-douglas-chino-pant?crpid=8725024997436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 78,
          "currentPrice": "$69.98",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-slim-eclipse-jean?crpid=7152703799356",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 77,
          "currentPrice": "$50.98",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-light-brown-straight-fit-jean?crpid=8804203233340",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 77,
          "currentPrice": "$63.99",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-ace-military-skinny-jean?crpid=8804180656188",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 77,
          "currentPrice": "$55.99",
          "originalPrice": "$245.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/boss-hugo-boss-jacket?crpid=7910201065532",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "BOSS Hugo Boss",
          "savings": 77,
          "currentPrice": "$91.99",
          "originalPrice": "$398.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/john-varvatos-ross-slim-fit-sport-shirt-1?crpid=8631207919676",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "John Varvatos",
          "savings": 77,
          "currentPrice": "$50.99",
          "originalPrice": "$218.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-stretch-garfield-belt?crpid=8742733873212",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 77,
          "currentPrice": "$39.98",
          "originalPrice": "$175.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/ted-baker-gray-popcorn-stripe-polo-shirt?crpid=8742724239420",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Ted Baker",
          "savings": 77,
          "currentPrice": "$37.99",
          "originalPrice": "$165.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cooper-signature-logo-crossbody-bag?crpid=8795875442748",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Michael Kors Outlet",
          "savings": 77,
          "currentPrice": "$59.60",
          "originalPrice": "$258.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/reiss-harry-jersey-slim-trouser?crpid=8618284187708",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Reiss",
          "savings": 77,
          "currentPrice": "$42.99",
          "originalPrice": "$190.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-linen-blend-button-shirt?crpid=8817626447932",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 76,
          "currentPrice": "$47.99",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/james-campbell-overshirt-5?crpid=8798287462460",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "James Campbell",
          "savings": 76,
          "currentPrice": "$47.99",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-fleece-graphic-hoodie-1?crpid=8675775414332",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 76,
          "currentPrice": "$27.99",
          "originalPrice": "$118.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-dark-grey-straight-fit-5-pocket-jean-1?crpid=8755520700476",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 76,
          "currentPrice": "$27.99",
          "originalPrice": "$118.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-rammy-shirt-1?crpid=7871599411260",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 76,
          "currentPrice": "$54.98",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-grey-silas-short?crpid=8801231798332",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 76,
          "currentPrice": "$27.99",
          "originalPrice": "$118.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-dover-slim-fit-jacket-3?crpid=7815622033468",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 76,
          "currentPrice": "$60.98",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-blue-silas-short-1?crpid=8801228128316",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 76,
          "currentPrice": "$27.99",
          "originalPrice": "$118.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-clifton-light-blue-pastel-straight-fit-jean?crpid=8680393703484",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 76,
          "currentPrice": "$35.98",
          "originalPrice": "$148.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/simkhai-jake-slim-trouser-1?crpid=7960274010172",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SIMKHAI",
          "savings": 76,
          "currentPrice": "$82.98",
          "originalPrice": "$345.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-grosvenor-slim-fit-jacket?crpid=7513403097148",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 76,
          "currentPrice": "$64.98",
          "originalPrice": "$275.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/autumn-cashmere-cashmere-blend-button-pullover-1?crpid=8613045895228",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Autumn Cashmere",
          "savings": 76,
          "currentPrice": "$87.99",
          "originalPrice": "$360.15",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/james-campbell-overshirt-4?crpid=8798286086204",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "James Campbell",
          "savings": 76,
          "currentPrice": "$47.99",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paige-everett-shirt-4?crpid=8704135397436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paige",
          "savings": 76,
          "currentPrice": "$39.98",
          "originalPrice": "$169.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-rockwell-pant?crpid=8725360508988",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 76,
          "currentPrice": "$69.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-rockwell-pant-1?crpid=8737164394556",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 76,
          "currentPrice": "$69.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-rockwell-pant-2?crpid=8737180483644",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 76,
          "currentPrice": "$69.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-rockwell-pant-3?crpid=8755528597564",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 76,
          "currentPrice": "$69.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-cruise-boxer-short-4?crpid=8735884902460",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 76,
          "currentPrice": "$19.98",
          "originalPrice": "$85.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-cruise-boxer-short-2?crpid=8735866486844",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 76,
          "currentPrice": "$19.98",
          "originalPrice": "$85.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-classic-fit-linen-blend-woven-shirt?crpid=6861514932284",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 76,
          "currentPrice": "$43.98",
          "originalPrice": "$185.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/robert-talbott-op-rockwell-pant-4?crpid=8755529842748",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Robert Talbott",
          "savings": 76,
          "currentPrice": "$69.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/profound-tie-dye-face-mask?crpid=8716346163260",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Profound™",
          "savings": 76,
          "currentPrice": "$5.98",
          "originalPrice": "$25.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-plaid-montauk-woven-shirt-1?crpid=7918969684028",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 76,
          "currentPrice": "$30.99",
          "originalPrice": "$128.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-mini-bloom-boom-montauk-woven-shirt?crpid=7918730674236",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 76,
          "currentPrice": "$30.99",
          "originalPrice": "$128.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/profound-tie-dye-face-mask-1?crpid=8716413796412",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Profound™",
          "savings": 76,
          "currentPrice": "$5.98",
          "originalPrice": "$25.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-curtis-linen-blend-pant?crpid=8621219315772",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 75,
          "currentPrice": "$61.99",
          "originalPrice": "$245.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-leather-trucker-jacket?crpid=8799559057468",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$299.50",
          "originalPrice": "$1,198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-quilted-vest?crpid=8799561023548",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$82.00",
          "originalPrice": "$328.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-novelty-denim-jacket?crpid=8586523705404",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$162.50",
          "originalPrice": "$650.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-denim-overshirt?crpid=7849032646716",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$137.50",
          "originalPrice": "$550.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-track-jacket?crpid=7576526159932",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$112.50",
          "originalPrice": "$450.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-panel-washed-slub-polo-shirt-1?crpid=8677194596412",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 75,
          "currentPrice": "$21.99",
          "originalPrice": "$88.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/tailorbyrd-super-soft-sweater-shirt-3?crpid=8701172645948",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "TailorByrd",
          "savings": 75,
          "currentPrice": "$27.99",
          "originalPrice": "$110.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-knit-polo-1?crpid=7974702874684",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$82.00",
          "originalPrice": "$328.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-clinton-linen-blend-blazer?crpid=8618350805052",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 75,
          "currentPrice": "$132.99",
          "originalPrice": "$525.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/faherty-sunwashed-boardshort?crpid=8592628252732",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Faherty",
          "savings": 75,
          "currentPrice": "$29.98",
          "originalPrice": "$118.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-beige-straight-fit-jean-1?crpid=8804218404924",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 75,
          "currentPrice": "$63.99",
          "originalPrice": "$255.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/grayers-herringbone-twill-shirt?crpid=8731121451068",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Grayers",
          "savings": 75,
          "currentPrice": "$27.99",
          "originalPrice": "$110.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/grayers-lorenzo-dobby-weave-shirt?crpid=8704135102524",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Grayers",
          "savings": 75,
          "currentPrice": "$27.99",
          "originalPrice": "$110.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/raffi-diagonal-stripe-1-4-zip-cashmere-mock-neck-sweater-2?crpid=8703539707964",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Raffi",
          "savings": 75,
          "currentPrice": "$126.98",
          "originalPrice": "$505.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-essential-t-shirt-5?crpid=8703477809212",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 75,
          "currentPrice": "$40.99",
          "originalPrice": "$165.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-pocket-t-shirt?crpid=7106671411260",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$44.50",
          "originalPrice": "$178.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-garvin-wool-blend-flannel-shirt?crpid=8639462965308",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 75,
          "currentPrice": "$96.99",
          "originalPrice": "$395.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-snap-overshirt?crpid=8639076761660",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 75,
          "currentPrice": "$96.99",
          "originalPrice": "$395.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/giuseppe-zanotti-mister-euphoria?crpid=8625460379708",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Giuseppe Zanotti",
          "savings": 75,
          "currentPrice": "$313.00",
          "originalPrice": "$1,250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/faherty-sunwashed-boardshort-2?crpid=8592700833852",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Faherty",
          "savings": 75,
          "currentPrice": "$29.98",
          "originalPrice": "$118.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-moonbay-stripe-shirt?crpid=7952420503612",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 75,
          "currentPrice": "$56.98",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/brooks-mens-down-puffer-vest?crpid=8799813795900",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Rudsak",
          "savings": 75,
          "currentPrice": "$199.99",
          "originalPrice": "$795.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/rta-oversized-shirt-1?crpid=7731500646460",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "RtA",
          "savings": 75,
          "currentPrice": "$146.98",
          "originalPrice": "$595.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/curatore-suede-penny-loafer-1?crpid=8119608606780",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Curatore",
          "savings": 75,
          "currentPrice": "$97.98",
          "originalPrice": "$395.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-armie-garment-dyed-linen-blend-blazer?crpid=8674314387516",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 75,
          "currentPrice": "$179.98",
          "originalPrice": "$710.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cole-haan-wool-blend-coat-1?crpid=8625306861628",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cole Haan",
          "savings": 75,
          "currentPrice": "$100.98",
          "originalPrice": "$398.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/aquatalia-cristo-suede-sneaker-1?crpid=8631098998844",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "AQUATALIA",
          "savings": 75,
          "currentPrice": "$107.99",
          "originalPrice": "$425.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/lanvin-clay-leather-high-top-sneaker-2?crpid=7620155441212",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Lanvin",
          "savings": 75,
          "currentPrice": "$305.98",
          "originalPrice": "$1,210.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-long-sleeve-knit-polo?crpid=8799633670204",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$87.50",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-long-sleeve-button-down-shirt?crpid=7916312133692",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$62.50",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-wild-raglan-crewneck-long-sleeve-t-shirt-in-organic-cotton?crpid=7782134874172",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$49.50",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-signature-full-zip-windbreaker-in-recycled-polyester?crpid=7819712364604",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$124.50",
          "originalPrice": "$498.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-phil-bandana-short?crpid=8670994006076",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 75,
          "currentPrice": "$89.98",
          "originalPrice": "$365.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-linen-blend-jacket-1?crpid=8677273174076",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 75,
          "currentPrice": "$179.98",
          "originalPrice": "$710.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/giuseppe-zanotti-apocalypse-trek?crpid=8728140349500",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Giuseppe Zanotti",
          "savings": 75,
          "currentPrice": "$274.00",
          "originalPrice": "$1,095.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/coach-outlet-denim-jacket-2?crpid=7479651827772",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Coach Outlet",
          "savings": 75,
          "currentPrice": "$119.50",
          "originalPrice": "$478.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-suede-trim-quilted-vest?crpid=8731919155260",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 75,
          "currentPrice": "$59.98",
          "originalPrice": "$238.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/bogner-riley-wool-blend-pant-1?crpid=8735787974716",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Bogner",
          "savings": 75,
          "currentPrice": "$87.99",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/ambush-folding-t-shirt?crpid=7150247411772",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "AMBUSH",
          "savings": 75,
          "currentPrice": "$98.98",
          "originalPrice": "$400.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-linen-blend-jacket?crpid=8677268717628",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 75,
          "currentPrice": "$179.98",
          "originalPrice": "$710.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/atm-anthony-thomas-melillo-sporty-slim-cargo-short?crpid=7640292130876",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "ATM Anthony Thomas Melillo",
          "savings": 75,
          "currentPrice": "$62.98",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/james-perse-matte-stretch-poplin-woven-shirt?crpid=8660920893500",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "James Perse",
          "savings": 74,
          "currentPrice": "$91.99",
          "originalPrice": "$350.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cole-haan-signature-3-in-1-top-coat?crpid=8682181492796",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cole Haan",
          "savings": 74,
          "currentPrice": "$91.99",
          "originalPrice": "$358.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-white-oxford-pant-1?crpid=8802021474364",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 74,
          "currentPrice": "$63.99",
          "originalPrice": "$248.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-stripe-polo-shirt-1?crpid=8677312102460",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 74,
          "currentPrice": "$22.99",
          "originalPrice": "$88.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-dover-notch-slim-fit-jacket-1?crpid=7184495706172",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 74,
          "currentPrice": "$64.98",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-white-oxford-pant-3?crpid=8802022817852",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 74,
          "currentPrice": "$63.99",
          "originalPrice": "$248.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/blank-nyc-suede-jacket-9?crpid=8815815327804",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "BLANKNYC",
          "savings": 74,
          "currentPrice": "$103.99",
          "originalPrice": "$398.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dsquared2-graphic-t-shirt-8?crpid=8701321609276",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Dsquared2",
          "savings": 74,
          "currentPrice": "$99.98",
          "originalPrice": "$385.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-eaton-slim-5-button-vest?crpid=7344745054268",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 74,
          "currentPrice": "$31.98",
          "originalPrice": "$125.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/burberry-mens-be4426-50mm-sunglasses-1?crpid=8804156342332",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Burberry",
          "savings": 74,
          "currentPrice": "$99.98",
          "originalPrice": "$380.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/calvin-klein-refined-stretch-blazer-1?crpid=7807355387964",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Calvin Klein",
          "savings": 74,
          "currentPrice": "$70.98",
          "originalPrice": "$269.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-essential-wool-cardigan?crpid=8639493308476",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 74,
          "currentPrice": "$96.99",
          "originalPrice": "$375.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/james-perse-flight-pant?crpid=8677223497788",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "James Perse",
          "savings": 74,
          "currentPrice": "$85.99",
          "originalPrice": "$325.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-dover-notch-slim-fit-jacket-2?crpid=7184507994172",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 74,
          "currentPrice": "$64.98",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/raffi-intarsia-hoodie?crpid=8699661615164",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Raffi",
          "savings": 74,
          "currentPrice": "$143.98",
          "originalPrice": "$555.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-marylebone-slim-double-breasted-vest?crpid=7344674766908",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 74,
          "currentPrice": "$31.98",
          "originalPrice": "$125.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-dover-notch-jacket-15?crpid=7154016550972",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 74,
          "currentPrice": "$64.98",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-sueded-jersey-pocket-t-shirt-1?crpid=7261495394364",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 74,
          "currentPrice": "$31.98",
          "originalPrice": "$125.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/off-white-alien-arrow-over-t-shirt?crpid=8771089399868",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Off-White",
          "savings": 74,
          "currentPrice": "$199.98",
          "originalPrice": "$775.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-dover-notch-jacket-12?crpid=7152266182716",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 74,
          "currentPrice": "$64.98",
          "originalPrice": "$250.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/joe-s-jeans-the-brixton-zaire-straight-narrow-jean?crpid=8675896459324",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "JOE'S Jeans",
          "savings": 74,
          "currentPrice": "$48.99",
          "originalPrice": "$188.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/onia-jack-linen-blend-shirt-1?crpid=7971075653692",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Onia",
          "savings": 74,
          "currentPrice": "$45.98",
          "originalPrice": "$175.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-classic-fit-corduroy-shirt-1?crpid=7796937228348",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 74,
          "currentPrice": "$62.98",
          "originalPrice": "$245.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-dominic-linen-shirt?crpid=8722544132156",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 74,
          "currentPrice": "$53.98",
          "originalPrice": "$208.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/magaschoni-cashmere-hoodie?crpid=8728249204796",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Magaschoni",
          "savings": 74,
          "currentPrice": "$84.98",
          "originalPrice": "$328.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/todd-snyder-slim-fit-stretch-medium-indigo-wash-jean?crpid=8621238485052",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "TODD SNYDER",
          "savings": 74,
          "currentPrice": "$40.98",
          "originalPrice": "$158.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-brushed-flannel-shirt-2?crpid=7796975697980",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 74,
          "currentPrice": "$58.98",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/paisley-gray-samuel-spread-collar-shirt?crpid=8691713081404",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Paisley & Gray",
          "savings": 74,
          "currentPrice": "$24.99",
          "originalPrice": "$95.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/4-in-1-logo-belt-box-set?crpid=8707523510332",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Michael Kors Outlet",
          "savings": 74,
          "currentPrice": "$59.00",
          "originalPrice": "$228.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-dominick-overshirt?crpid=8732115599420",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 74,
          "currentPrice": "$53.98",
          "originalPrice": "$208.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/4-in-1-signature-logo-belt-box-set?crpid=8707524853820",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Michael Kors Outlet",
          "savings": 74,
          "currentPrice": "$59.00",
          "originalPrice": "$228.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-zane-reflex-skinny-leg-jean?crpid=8804152344636",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 73,
          "currentPrice": "$63.99",
          "originalPrice": "$235.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-linen-blend-short-1?crpid=7952484827196",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 73,
          "currentPrice": "$59.98",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-oxford-shirt-3?crpid=8817627660348",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 73,
          "currentPrice": "$49.98",
          "originalPrice": "$188.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-zack-newell-skinny-jean?crpid=8804229349436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 73,
          "currentPrice": "$63.99",
          "originalPrice": "$235.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/james-perse-plaid-wool-alpaca-mohair-blend-car-coat?crpid=8677328650300",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "James Perse",
          "savings": 73,
          "currentPrice": "$431.99",
          "originalPrice": "$1,595.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-popcorn-pique-polo-shirt-1?crpid=8677231722556",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 73,
          "currentPrice": "$23.99",
          "originalPrice": "$88.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-poplin-stripe-shirt?crpid=8820429455420",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 73,
          "currentPrice": "$49.98",
          "originalPrice": "$188.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/faherty-stretch-terry-pant-6?crpid=8639374262332",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Faherty",
          "savings": 73,
          "currentPrice": "$44.99",
          "originalPrice": "$168.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-linen-blend-short?crpid=7952400711740",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 73,
          "currentPrice": "$59.98",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/7-for-all-mankind-oxford-button-down-shirt?crpid=8817632575548",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "7 For All Mankind",
          "savings": 73,
          "currentPrice": "$49.98",
          "originalPrice": "$188.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/burberry-womens-3149-60mm-sunglasses?crpid=8627865157692",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Burberry",
          "savings": 73,
          "currentPrice": "$99.98",
          "originalPrice": "$373.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/ferragamo-beck-suede-leather-sneaker?crpid=7528197128252",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Salvatore Ferragamo",
          "savings": 73,
          "currentPrice": "$229.98",
          "originalPrice": "$850.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-pop-lime-slim-fit-jean?crpid=8804217585724",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 73,
          "currentPrice": "$79.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/james-campbell-overshirt-2?crpid=8798285758524",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "James Campbell",
          "savings": 73,
          "currentPrice": "$47.99",
          "originalPrice": "$178.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cole-haan-melton-3-in-1-wool-blend-coat?crpid=8625306894396",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cole Haan",
          "savings": 73,
          "currentPrice": "$160.98",
          "originalPrice": "$598.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-eren-shirt-3?crpid=8677228150844",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$125.98",
          "originalPrice": "$465.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-beige-straight-fit-jean?crpid=8804154933308",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 73,
          "currentPrice": "$63.99",
          "originalPrice": "$235.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cavalli-class-2pc-slim-fit-wool-suit-2?crpid=7099303821372",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cavalli Class",
          "savings": 73,
          "currentPrice": "$399.98",
          "originalPrice": "$1,495.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-arthus-wool-jacket-1?crpid=8677310169148",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$251.98",
          "originalPrice": "$925.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/warfield-grand-leather-chelsea-boot?crpid=8818972360764",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Warfield & Grand",
          "savings": 73,
          "currentPrice": "$53.98",
          "originalPrice": "$199.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-lipp-shirt?crpid=8672605700156",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$84.98",
          "originalPrice": "$315.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/frame-denim-lhomme-vintage-dark-slim-jean?crpid=8676016652348",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "FRAME Denim",
          "savings": 73,
          "currentPrice": "$58.99",
          "originalPrice": "$218.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dl1961-hudson-perry-corduroy-shirt-jacket?crpid=8731918041148",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "DL1961",
          "savings": 73,
          "currentPrice": "$53.98",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-arthus-wool-jacket-2?crpid=8677360926780",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$251.98",
          "originalPrice": "$925.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-seersucker-jacket?crpid=8677184667708",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$233.98",
          "originalPrice": "$860.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-gregoire-jacquard-pant?crpid=8677353979964",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$152.98",
          "originalPrice": "$565.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-philip-wool-cashmere-blend-coat?crpid=8705943306300",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$466.98",
          "originalPrice": "$1,745.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-worsted-wool-jacket?crpid=8671102337084",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$199.98",
          "originalPrice": "$730.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/moorer-casciano-suede-down-jacket?crpid=8677227561020",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Moorer",
          "savings": 73,
          "currentPrice": "$1,525.98",
          "originalPrice": "$5,650.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-eren-shirt-2?crpid=8672683098172",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$80.98",
          "originalPrice": "$295.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/raffi-textured-1-4-zip-cashmere-mock-neck-sweater-2?crpid=8706150629436",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Raffi",
          "savings": 73,
          "currentPrice": "$134.98",
          "originalPrice": "$505.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/todd-snyder-lightweight-pewter-slim-fit-jean?crpid=8622298333244",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "TODD SNYDER",
          "savings": 73,
          "currentPrice": "$80.98",
          "originalPrice": "$298.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/ferragamo-nima-knit-sneaker?crpid=8671054463036",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Salvatore Ferragamo",
          "savings": 73,
          "currentPrice": "$269.98",
          "originalPrice": "$995.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/ted-baker-slim-fit-textured-chino-trouser-2?crpid=8708236378172",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Ted Baker",
          "savings": 73,
          "currentPrice": "$39.98",
          "originalPrice": "$150.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/raffi-trim-detail-wool-blend-polo-sweater-1?crpid=8678966624316",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Raffi",
          "savings": 73,
          "currentPrice": "$51.98",
          "originalPrice": "$190.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/onia-air-convertible-linen-blend-vacation-shirt-1?crpid=7924153352252",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Onia",
          "savings": 73,
          "currentPrice": "$51.98",
          "originalPrice": "$195.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-archer-jacket?crpid=8694795075644",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 73,
          "currentPrice": "$206.98",
          "originalPrice": "$765.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/raffi-diagonal-stripe-1-4-zip-cashmere-mock-neck-sweater-5?crpid=8703570116668",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Raffi",
          "savings": 73,
          "currentPrice": "$134.98",
          "originalPrice": "$505.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-marin-navy-combo-authentic-fit-jean?crpid=8755525713980",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 73,
          "currentPrice": "$39.98",
          "originalPrice": "$148.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/maison-heritage-cashmere-zip-sweater?crpid=8714054271036",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Maison Heritage",
          "savings": 73,
          "currentPrice": "$134.98",
          "originalPrice": "$491.55",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/the-kooples-wool-trouser-3?crpid=7283002605628",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "The Kooples",
          "savings": 73,
          "currentPrice": "$92.98",
          "originalPrice": "$340.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/billy-reid-john-shirt?crpid=7966063099964",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Billy Reid",
          "savings": 73,
          "currentPrice": "$60.98",
          "originalPrice": "$228.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/todd-snyder-dad-wash-slim-fit-jean?crpid=8621224362044",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "TODD SNYDER",
          "savings": 73,
          "currentPrice": "$53.98",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/spyder-lounge-pant?crpid=8706132410428",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Spyder",
          "savings": 72,
          "currentPrice": "$27.99",
          "originalPrice": "$99.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/new-balance-seasonal-premium-jacket?crpid=8651414437948",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "New Balance",
          "savings": 72,
          "currentPrice": "$53.99",
          "originalPrice": "$190.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/theory-wrinkle-check-silk-blend-shirt-2?crpid=7965894279228",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Theory",
          "savings": 72,
          "currentPrice": "$54.98",
          "originalPrice": "$195.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-newell-slim-fit-jean?crpid=8804210704444",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 72,
          "currentPrice": "$63.99",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-white-oxford-pant-2?crpid=8802021703740",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 72,
          "currentPrice": "$71.99",
          "originalPrice": "$258.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-stripe-polo-shirt?crpid=8677295882300",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 72,
          "currentPrice": "$24.99",
          "originalPrice": "$88.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cutter-buck-stealth-1-4-zip-pullover-3?crpid=8771924328508",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cutter & Buck",
          "savings": 72,
          "currentPrice": "$27.99",
          "originalPrice": "$100.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cutter-buck-stealth-1-4-zip-pullover-2?crpid=8771873603644",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cutter & Buck",
          "savings": 72,
          "currentPrice": "$27.99",
          "originalPrice": "$100.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/officine-generale-fresco-wool-jacket-3?crpid=8677360762940",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Officine Générale",
          "savings": 72,
          "currentPrice": "$233.98",
          "originalPrice": "$835.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/scotch-soda-ribbed-johnny-collar-shirt?crpid=8677215535164",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "SCOTCH & SODA",
          "savings": 72,
          "currentPrice": "$24.98",
          "originalPrice": "$88.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/frye-dylan-leather-oxford-2?crpid=8660804206652",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Frye",
          "savings": 72,
          "currentPrice": "$96.99",
          "originalPrice": "$348.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/j-mclaughlin-white-oxford-pant?crpid=8802019311676",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "J.McLaughlin",
          "savings": 72,
          "currentPrice": "$55.99",
          "originalPrice": "$198.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/hudson-jeans-blake-linen-blend-slim-straight-jean-1?crpid=8804153425980",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "HUDSON Jeans",
          "savings": 72,
          "currentPrice": "$63.99",
          "originalPrice": "$225.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/raffi-zip-mock-neck-cashmere-sweater?crpid=8701177397308",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Raffi",
          "savings": 72,
          "currentPrice": "$116.98",
          "originalPrice": "$420.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/slate-stone-ribbed-raglan-crewneck-sweater?crpid=8725387739196",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Slate & Stone",
          "savings": 72,
          "currentPrice": "$63.99",
          "originalPrice": "$228.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/dsquared2-graphic-t-shirt-11?crpid=8701325901884",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Dsquared2",
          "savings": 72,
          "currentPrice": "$99.98",
          "originalPrice": "$360.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/cutter-buck-stealth-1-4-zip-pullover-1?crpid=8771837853756",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Cutter & Buck",
          "savings": 72,
          "currentPrice": "$27.99",
          "originalPrice": "$100.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/slate-stone-crewneck-sweater?crpid=8730486702140",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Slate & Stone",
          "savings": 72,
          "currentPrice": "$63.99",
          "originalPrice": "$228.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/faherty-stretch-terry-pant-3?crpid=8618015326268",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Faherty",
          "savings": 72,
          "currentPrice": "$49.99",
          "originalPrice": "$178.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/report-collection-glen-woven-sport-coat-1?crpid=8705955299388",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Report Collection",
          "savings": 72,
          "currentPrice": "$84.98",
          "originalPrice": "$299.00",
          "tags": ""
        },
        {
          "url": "https://shop.simon.com/products/vince-olli-suede-leather-sneaker?crpid=8682186407996",
          "status": "accepted",
          "reason": "Meets all criteria",
          "brand": "Vince",
          "savings": 72,
          "currentPrice": "$69.99",
          "originalPrice": "$250.00",
          "tags": ""
        },
];

/**
 * Processes a single URL and extracts product data
 *
 * @param {Page} page - Playwright page object
 * @param {Object} urlObj - URL object containing url, tags, brand, typeitem
 * @param {number} index - Current URL index for logging
 * @param {number} total - Total number of URLs
 * @returns {Promise<{success: boolean, data: {productRows: Array<Object>, extraImageRows: Array<Object>}, url: Object}>} Extracted product data
 */
async function processSingleUrl(page, urlObj, index, total) {
  const { url } = urlObj;

  try {
    console.log(`\n🔎 [${index}/${total}] Extracting: ${url}`);

    const startTime = Date.now();
    const { productRows, extraImageRows } = await extractProductData(page, urlObj);
    const endTime = Date.now();

    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Finished: ${url} — Extracted ${productRows.length} product rows and ${extraImageRows.length} extra image rows in ${duration}s`
    );

    return { 
      success: true, 
      data: { productRows, extraImageRows }, 
      url: urlObj 
    };
  } catch (error) {
    console.error(`❌ Error extracting ${url}:`, error.message);
    return { success: false, error: error.message, url: urlObj };
  }
}

/**
 * Processes URLs in batches to avoid overwhelming the server
 *
 * @param {Page} page - Playwright page object
 * @param {Array<Object>} urls - Array of URL objects
 * @returns {Promise<{successful: Array<Object>, failed: Array<Object>}>} Processing results
 */
async function processUrlsInBatches(page, urls) {
  const successful = [];
  const failed = [];

  console.log(`🚀 Starting extraction of ${urls.length} URLs...`);

  for (let i = 0; i < urls.length; i++) {
    const urlObj = urls[i];
    const result = await processSingleUrl(page, urlObj, i + 1, urls.length);

    if (result.success) {
      successful.push(...result.data.productRows);
      // Add extra image rows to successful as well
      if (result.data.extraImageRows.length > 0) {
        successful.push(...result.data.extraImageRows);
      }
    } else {
      failed.push(result.url);
    }

    // Add delay between requests to be respectful to the server
    if (i < urls.length - 1) {
      console.log(
        `⏳ Waiting ${CONFIG.DELAY_BETWEEN_REQUESTS}ms before next request...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
      );
    }
  }

  return { successful, failed };
}

/**
 * Main function that orchestrates the scraping process
 */
async function main() {
  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log("🎯 Simon Product Details Scraper");
    console.log("==================================");

    // Validate input
    if (!PRODUCT_URLS || PRODUCT_URLS.length === 0) {
      throw new Error("No URLs provided for scraping");
    }

    // Initialize browser
    browser = await launchBrowser();
    context = await createBrowserContext(browser);
    page = await createPage(context);

    // Process URLs
    const { successful, failed } = await processUrlsInBatches(
      page,
      PRODUCT_URLS
    );

    // Save results
    if (successful.length > 0) {
      saveToCSV(successful, failed);
    } else {
      console.warn("⚠️ No data extracted. CSV file was not created.");
    }

    // Summary
    console.log("\n📊 Extraction Summary:");
    console.log(`✅ Successful: ${successful.length} rows extracted`);
    console.log(`❌ Failed: ${failed.length} URLs failed`);
    console.log(
      `📈 Success rate: ${(
        (successful.length / (successful.length + failed.length)) *
        100
      ).toFixed(1)}%`
    );
  } catch (error) {
    console.error("💥 Fatal error during scraping:", error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (page) {
      try {
        await page.close();
        console.log("📄 Page closed");
      } catch (error) {
        console.warn("⚠️ Failed to close page:", error.message);
      }
    }

    if (context) {
      try {
        await context.close();
        console.log("🌐 Browser context closed");
      } catch (error) {
        console.warn("⚠️ Failed to close browser context:", error.message);
      }
    }

    if (browser) {
      try {
        await browser.close();
        console.log("🚀 Browser closed");
      } catch (error) {
        console.warn("⚠️ Failed to close browser:", error.message);
      }
    }

    console.log("🏁 Scraping process completed");
  }
}

main();

export { main, processSingleUrl, processUrlsInBatches };
