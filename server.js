/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Single Node/Express server that:
 * - Uses axios and Cheerio to scrape the live gold price (USD per gram)
 * - Caches the gold price and updates it every 1 minute
 * - Calculates product prices using the cached gold price
 * - Serves the static frontend files
 * - Exposes an API endpoint (/api/products) with filtering and ordering
 ****************************************************************************/

const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const products = require("./products.json");

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins
app.use(cors({ origin: "*" }));

// ---- Gold Price ---- //
let goldPrice = 0;

/**
 * Uses axios and Cheerio to scrape the gold price from Kitco.
 * It looks for the <li> element with "gram" in its price name, then
 * extracts the price from the corresponding <p> with the price class.
 */
async function updateGoldPrice() {
  try {
    const response = await axios.get("https://www.kitco.com/charts/gold", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 30000,
    });
    const $ = cheerio.load(response.data);

    // Find <li> that has "gram" in its text
    const li = $("li.flex.items-center")
      .filter((i, el) => {
        const priceName = $(el)
          .find("p.CommodityPrice_priceName__Ehicd")
          .text()
          .toLowerCase();
        return priceName.includes("gram");
      })
      .first();

    if (!li || li.length === 0) {
      throw new Error("No matching 'gram' element found in kitco.com HTML");
    }

    // Within that <li>, find the price
    const priceElem = li
      .find("p.CommodityPrice_convertPrice__5Addh")
      .not(".CommodityPrice_down__WC3cT")
      .first();
    let priceStr = priceElem.text().replace(",", ".").trim();
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      throw new Error("Could not parse gold price");
    }

    goldPrice = price;
    console.log(`Gold price per gram updated: ${goldPrice.toFixed(2)} USD`);
  } catch (err) {
    console.error("Error fetching gold price:", err.message);
    if (!goldPrice) {
      // Fallback to a known approximate price if first fetch fails
      goldPrice = 92.67;
    }
    console.warn(
      `Falling back to latest known gold price: ${goldPrice.toFixed(2)} USD`
    );
  }
}

// Call once at startup, then every minute
updateGoldPrice();
setInterval(updateGoldPrice, 60000);

// ---- API Routes ---- //
const apiRouter = express.Router();

apiRouter.get("/products", (req, res) => {
  const { minPrice, maxPrice, minRating, maxRating, sortBy } = req.query;

  // Build a list of computed products
  let result = products.map((product) => {
    // Price formula: (popularityScore + 1) * weight * goldPrice
    const computedPrice =
      (product.popularityScore + 1) * product.weight * goldPrice;
    const rating = (product.popularityScore * 5).toFixed(1);

    return {
      ...product,
      price: Math.round(computedPrice),
      rating: parseFloat(rating),
    };
  });

  // Filter
  if (minPrice) result = result.filter((p) => p.price >= parseFloat(minPrice));
  if (maxPrice) result = result.filter((p) => p.price <= parseFloat(maxPrice));
  if (minRating)
    result = result.filter((p) => p.rating >= parseFloat(minRating));
  if (maxRating)
    result = result.filter((p) => p.rating <= parseFloat(maxRating));

  // Sorting
  if (sortBy) {
    if (sortBy === "price") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "ratio") {
      // rating/price ratio high to low
      result.sort((a, b) => b.rating / b.price - a.rating / a.price);
    }
  }

  console.log("API /products returning", result.length, "products");
  res.json(result);
});

// Mount router
app.use("/api", apiRouter);

// ---- Serve Static Files ---- //
app.use(express.static(path.join(__dirname, "frontend")));

// ---- Catch-all Route ---- //
app.get("*", (req, res) => {
  // If the request path starts with "/api", return a 404 JSON
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  // Otherwise, serve the frontend
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ---- Start the Server ---- //
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
