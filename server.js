/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Merged Node/Express server that:
 * - Uses Playwright to scrape the live gold price (USD per gram) from GoldAvenue.
 * - Caches the gold price and updates it every 1 minute (with retries).
 * - Calculates product prices using the cached gold price.
 * - Serves the frontend static files and exposes an API endpoint (/api/products)
 *   with filtering and ordering.
 *
 * Note: Product prices are rounded to the nearest whole number.
 ****************************************************************************/
const express = require("express");
const cors = require("cors");
const path = require("path");
const products = require("./products.json"); // Your product data file
const { chromium } = require("playwright");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.static(path.join(__dirname, "frontend")));

// Global variable to store the latest gold price per gram in USD
let goldPrice = 0;

/**
 * Uses Playwright to launch a headless browser, navigates to GoldAvenue's page,
 * and extracts the gold price from the h3 element.
 * Retries up to 3 times before falling back.
 */

async function updateGoldPrice() {
  try {
    const response = await axios.get(
      "https://www.goldavenue.com/en/gold-price/usd",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
        timeout: 30000,
      }
    );
    const $ = cheerio.load(response.data);
    // Select the first <h3> element with class "sc-8fad5955-0 jwMhFP"
    const priceText = $("h3.sc-8fad5955-0.jwMhFP").first().text();
    // Remove the "$" and trim whitespace
    let priceStr = priceText.replace("$", "").trim();
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
  }
}

// Start by updating the gold price once before starting the server,
// then schedule updates every 1 minute.
async function startServer() {
  await updateGoldPrice();
  setInterval(updateGoldPrice, 60000);

  // API Endpoint: /api/products
  app.get("/api/products", (req, res) => {
    const { minPrice, maxPrice, minRating, maxRating, sortBy } = req.query;
    let result = products.map((product) => {
      // Price formula: (popularityScore + 1) * weight * goldPrice
      const computedPrice =
        (product.popularityScore + 1) * product.weight * goldPrice;
      // Convert popularityScore (0–1) to rating out of 5
      const rating = (product.popularityScore * 5).toFixed(1);
      return {
        ...product,
        price: Math.round(computedPrice),
        rating: parseFloat(rating),
      };
    });

    // Filtering
    if (minPrice)
      result = result.filter((p) => p.price >= parseFloat(minPrice));
    if (maxPrice)
      result = result.filter((p) => p.price <= parseFloat(maxPrice));
    if (minRating)
      result = result.filter((p) => p.rating >= parseFloat(minRating));
    if (maxRating)
      result = result.filter((p) => p.rating <= parseFloat(maxRating));

    // Ordering
    if (sortBy) {
      if (sortBy === "price") {
        result.sort((a, b) => a.price - b.price);
      } else if (sortBy === "rating") {
        result.sort((a, b) => b.rating - a.rating);
      } else if (sortBy === "ratio") {
        result.sort((a, b) => b.rating / b.price - a.rating / a.price);
      }
    }
    res.json(result);
  });

  // Serve the frontend for any unknown route (supporting client-side routing)
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
