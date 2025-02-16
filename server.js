/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Merged Node/Express server that:
 * - Uses axios and Cheerio to scrape the live gold price (USD per gram)
 *   from GoldAvenue.
 * - Caches the gold price and updates it every 1 minute.
 * - Calculates product prices using the cached gold price.
 * - Serves the frontend static files and exposes an API endpoint (/api/products)
 *   with filtering and ordering.
 *
 * Note: Product prices are rounded to the nearest whole number.
 ****************************************************************************/
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const products = require("./products.json");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.static(path.join(__dirname, "frontend")));

let goldPrice = 0;

/**
 * Uses axios and Cheerio to scrape the gold price from GoldAvenue.
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
    // Select the first h3 element with the target classes.
    let priceStr = $("h3.sc-8fad5955-0.jwMhFP").first().text();
    // Remove the "$" sign and trim
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
  }
}

async function startServer() {
  await updateGoldPrice();
  setInterval(updateGoldPrice, 60000);

  app.get("/api/products", (req, res) => {
    const { minPrice, maxPrice, minRating, maxRating, sortBy } = req.query;
    let result = products.map((product) => {
      const computedPrice =
        (product.popularityScore + 1) * product.weight * goldPrice;
      const rating = (product.popularityScore * 5).toFixed(1);
      return {
        ...product,
        price: Math.round(computedPrice),
        rating: parseFloat(rating),
      };
    });

    if (minPrice)
      result = result.filter((p) => p.price >= parseFloat(minPrice));
    if (maxPrice)
      result = result.filter((p) => p.price <= parseFloat(maxPrice));
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
    res.json(result);
  });

  // Serve frontend for all other routes (client-side routing support)
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
