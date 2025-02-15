/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Node/Express backend that:
 * - Scrapes the live gold price (USD per gram) from Kitco using Playwright.
 * - Caches the gold price and updates it every 1 minute.
 * - Calculates product prices using the cached gold price.
 * - Returns products with optional filtering by price (USD) and rating (0-5),
 *   as well as ordering by price, rating, or rating/price ratio.
 *
 * Note: Product prices are rounded to the nearest whole number.
 ****************************************************************************/
const express = require("express");
const cors = require("cors");
const products = require("./products.json"); // Your product data file

// Use Playwright instead of Puppeteer
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Global variable to store the latest gold price per gram in USD
let goldPrice = 0;

/**
 * Uses Playwright to launch a headless Chromium browser,
 * navigates to Kitco's gold charts page, finds the list item containing "gram",
 * and extracts the gold price.
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

    await page.goto("https://www.kitco.com/charts/gold", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Wait for at least one li element with the target class to appear
    await page.waitForSelector("li.flex.items-center", { timeout: 10000 });

    // Get all matching li elements
    const liElements = await page.$$("li.flex.items-center");

    let targetHandle = null;
    // Loop through each li element to find one where the price name includes "gram"
    for (const li of liElements) {
      try {
        const priceNameEl = await li.$("p.CommodityPrice_priceName__Ehicd");
        if (!priceNameEl) continue;
        const priceName = await priceNameEl.innerText();
        if (priceName.toLowerCase().includes("gram")) {
          targetHandle = li;
          break;
        }
      } catch (e) {
        // Ignore errors and continue
      }
    }

    if (!targetHandle) {
      throw new Error("Could not locate target element containing 'gram'");
    }

    // Within the target li, find the price element
    const priceElem = await targetHandle.$(
      "p.CommodityPrice_convertPrice__5Addh"
    );
    if (!priceElem) {
      throw new Error("Could not find price element in the target li");
    }

    let priceStr = await priceElem.innerText();
    priceStr = priceStr.trim().replace(",", "."); // Convert comma to dot
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      throw new Error("Could not parse gold price");
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
    if (browser) {
      await browser.close();
    }
  }
}

// Initial fetch and schedule periodic updates every 1 minute (60,000 ms)
updateGoldPrice();
setInterval(updateGoldPrice, 60000);

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
