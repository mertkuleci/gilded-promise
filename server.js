/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Node/Express backend that:
 * - Fetches live gold price from GoldAPI once and caches it.
 * - Updates the gold price every 5 minutes.
 * - Calculates product prices using the cached gold price.
 * - Returns products with optional filtering by price (USD) and rating (0-5),
 *   as well as ordering by price, rating, or rating/price ratio.
 *
 * Note: Product prices are rounded to the nearest whole number.
 ****************************************************************************/
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const products = require("./products.json"); // Your product data file

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Global variable to store the latest gold price per gram in USD
let goldPrice = 0;

// Function to update the gold price using GoldAPI with caching
async function updateGoldPrice() {
  try {
    const response = await axios.get("https://www.goldapi.io/api/XAU/USD", {
      headers: {
        "x-access-token": "YOUR_UPDATED_API_KEY", // Replace with your updated API key
        "Content-Type": "application/json",
      },
    });
    // GoldAPI returns price per troy ounce; convert to per gram
    const pricePerOunce = response.data.price;
    goldPrice = pricePerOunce / 31.1035;
    console.log(`Gold price per gram updated: ${goldPrice.toFixed(2)} USD`);
  } catch (err) {
    console.error("Error fetching gold price:", err.message);
    // Use previously cached value, or fall back to default if not set
    if (!goldPrice) {
      goldPrice = 92.67;
    }
    console.warn(
      `Falling back to latest known gold price: ${goldPrice.toFixed(2)} USD`
    );
  }
}

// Initial fetch and schedule periodic updates every 5 minutes (300,000 ms)
updateGoldPrice();
setInterval(updateGoldPrice, 300000);

// GET endpoint to return products with optional filtering and ordering
app.get("/api/products", (req, res) => {
  const { minPrice, maxPrice, minRating, maxRating, sortBy } = req.query;

  // Map products to include calculated price and rating
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

  // Apply filtering if query parameters are provided
  if (minPrice) result = result.filter((p) => p.price >= parseFloat(minPrice));
  if (maxPrice) result = result.filter((p) => p.price <= parseFloat(maxPrice));
  if (minRating)
    result = result.filter((p) => p.rating >= parseFloat(minRating));
  if (maxRating)
    result = result.filter((p) => p.rating <= parseFloat(maxRating));

  // Apply ordering if provided
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
