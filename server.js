/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Merged Node/Express server that:
 * - Uses Playwright to scrape the live gold price (USD per gram) from Kitco.
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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.static(path.join(__dirname, "frontend")));

// Global variable to store the latest gold price per gram in USD
let goldPrice = 0;

/**
 * Uses Playwright with a retry loop to fetch and update the gold price.
 */
async function updateGoldPrice() {
  let browser;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto("https://www.kitco.com/charts/gold", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Use a more specific locator: find li.flex.items-center that has a <p> with the target class
      const locator = page.locator(
        "li.flex.items-center:has(p.CommodityPrice_priceName__Ehicd)"
      );
      await locator.first().waitFor({ state: "visible", timeout: 15000 });

      const count = await locator.count();
      let targetElement = null;
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        try {
          const priceName = await el
            .locator("p.CommodityPrice_priceName__Ehicd")
            .innerText();
          if (priceName.toLowerCase().includes("gram")) {
            targetElement = el;
            break;
          }
        } catch (err) {
          // ignore errors and continue
        }
      }

      if (!targetElement) {
        throw new Error("Target element containing 'gram' not found");
      }

      // Extract the price from the corresponding price element
      const priceElem = targetElement.locator(
        "p.CommodityPrice_convertPrice__5Addh"
      );
      await priceElem.waitFor({ state: "visible", timeout: 10000 });
      let priceStr = await priceElem.innerText();
      priceStr = priceStr.trim().replace(",", "."); // Convert comma to dot
      const price = parseFloat(priceStr);
      if (isNaN(price)) {
        throw new Error("Could not parse gold price");
      }
      goldPrice = price;
      console.log(`Gold price per gram updated: ${goldPrice.toFixed(2)} USD`);
      return; // Successful update; exit the retry loop
    } catch (err) {
      console.error(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt === maxRetries) {
        if (!goldPrice) {
          goldPrice = 92.67;
        }
        console.warn(
          `Falling back to latest known gold price: ${goldPrice.toFixed(2)} USD`
        );
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
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

  // Serve frontend for any other route
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
