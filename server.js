/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Merged Node/Express server that:
 * - Uses Playwright to scrape the live gold price (USD per gram) from GoldAvenue.
 * - Caches the gold price and updates it every 1 minute.
 * - Calculates product prices using the cached gold price.
 * - Serves the static frontend files.
 * - Exposes API endpoints (under /api) with filtering and ordering.
 *
 * Note: Product prices are rounded to the nearest whole number.
 ****************************************************************************/
const express = require("express");
const cors = require("cors");
const path = require("path");
const products = require("./products.json");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// --- Create an API router for endpoints under /api ---
const apiRouter = express.Router();

apiRouter.get("/products", (req, res) => {
  const { minPrice, maxPrice, minRating, maxRating, sortBy } = req.query;
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
  if (minPrice) result = result.filter((p) => p.price >= parseFloat(minPrice));
  if (maxPrice) result = result.filter((p) => p.price <= parseFloat(maxPrice));
  if (minRating)
    result = result.filter((p) => p.rating >= parseFloat(minRating));
  if (maxRating)
    result = result.filter((p) => p.rating <= parseFloat(maxRating));
  if (sortBy) {
    if (sortBy === "price") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "ratio") {
      result.sort((a, b) => b.rating / b.price - a.rating / a.price);
    }
  }
  console.log("API /products returning", result.length, "products");
  res.json(result);
});

// Mount the API router under /api
app.use("/api", apiRouter);

// --- Serve static files from the "frontend" folder ---
app.use(express.static(path.join(__dirname, "frontend")));

// For any unknown route, send back index.html (for client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// --- Gold price fetching ---
let goldPrice = 0;

/**
 * Uses Playwright to scrape the gold price from GoldAvenue.
 * It navigates to the page, waits for the h3 element with class "jwMhFP",
 * extracts the price, removes the "$" sign, and updates goldPrice.
 */
async function updateGoldPrice() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.goldavenue.com/en/gold-price/usd", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for the target element that should contain the price
    const priceElem = await page.waitForSelector("h3.jwMhFP", {
      timeout: 15000,
    });
    let priceStr = await priceElem.innerText();
    priceStr = priceStr.replace("$", "").trim();
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      throw new Error("Could not parse gold price from GoldAvenue");
    }
    goldPrice = price;
    console.log(`Gold price per gram updated: ${goldPrice.toFixed(2)} USD`);
  } catch (err) {
    console.error("Error fetching gold price:", err.message);
    if (!goldPrice) {
      goldPrice = 92.67;
    }
    console.warn(
      `Falling back to latest known gold price: ${goldPrice.toFixed(2)} USD`
    );
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Start the server only after an initial gold price update.
 * Then schedule updates every minute.
 */
async function startServer() {
  await updateGoldPrice();
  setInterval(updateGoldPrice, 60000);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
