/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Node/Express backend that:
 * - Scrapes the live gold price (USD per gram) from Kitco using Puppeteer.
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

// Require Puppeteer
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Global variable to store the latest gold price per gram in USD
let goldPrice = 0;

/**
 * Uses Puppeteer to launch a headless Chrome/Chromium,
 * navigate to Kitco, find the "gram" list item, and extract the gold price.
 */
async function updateGoldPrice() {
  let browser;
  try {
    // Launch Puppeteer in headless mode with some common flags
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Go to the Kitco gold charts page; wait for network to be idle
    await page.goto("https://www.kitco.com/charts/gold", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait for the <li> elements with "flex items-center" to appear
    await page.waitForSelector("li.flex.items-center", { timeout: 10000 });

    // Grab all matching <li> elements
    const liHandles = await page.$$("li.flex.items-center");

    let targetHandle = null;
    // Loop over each <li> to find one whose child p.CommodityPrice_priceName__Ehicd includes "gram"
    for (const li of liHandles) {
      try {
        const priceNameEl = await li.$("p.CommodityPrice_priceName__Ehicd");
        if (!priceNameEl) continue;
        const priceName = (
          await page.evaluate((el) => el.innerText, priceNameEl)
        ).toLowerCase();
        if (priceName.includes("gram")) {
          targetHandle = li;
          break;
        }
      } catch (e) {
        // ignore errors in this loop
      }
    }

    if (!targetHandle) {
      throw new Error("Could not locate <li> element containing 'gram'");
    }

    // Within the target <li>, find the <p> with class "CommodityPrice_convertPrice__5Addh"
    const priceElem = await targetHandle.$(
      "p.CommodityPrice_convertPrice__5Addh"
    );
    if (!priceElem) {
      throw new Error("Could not find price element in the 'gram' <li>");
    }

    // Extract the text and parse as float
    let priceStr = await page.evaluate((el) => el.innerText, priceElem);
    priceStr = priceStr.trim().replace(",", ".");
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      throw new Error("Could not parse gold price");
    }

    goldPrice = price;
    console.log(`Gold price per gram updated: ${goldPrice.toFixed(2)} USD`);
  } catch (err) {
    console.error("Error fetching gold price:", err.message);
    // If goldPrice is not set, default to 92.67
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
