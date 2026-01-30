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
