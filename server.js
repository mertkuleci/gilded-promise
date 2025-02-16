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
 * Uses Playwright to launch a headless browser, navigates to Kitco's gold charts page,
 * finds the list item containing "gram", and extracts the gold price.
 * Uses a retry mechanism for robustness.
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

      // Wait for li elements that match the base selector
      await page.waitForSelector("li.flex.items-center", { timeout: 15000 });
      const liElements = await page.$$("li.flex.items-center");

      let targetHandle = null;
      // Loop over li elements to find one where a child <p> with class "CommodityPrice_priceName__Ehicd"
      // contains "gram" (case-insensitive)
      for (const li of liElements) {
        try {
          const priceNameEl = await li.$("p.CommodityPrice_priceName__Ehicd");
          if (!priceNameEl) continue;
          const priceName = (await priceNameEl.innerText()).toLowerCase();
          if (priceName.includes("gram")) {
            targetHandle = li;
            break;
          }
        } catch (e) {
          // Skip errors
        }
      }

      if (!targetHandle) {
        throw new Error("Could not locate target element containing 'gram'");
      }

      // Use a more specific selector to avoid multiple matches.
      // We exclude any <p> that has the "CommodityPrice_down__WC3cT" class.
      const priceElem = await targetHandle.$(
        "p.CommodityPrice_convertPrice__5Addh:not(.CommodityPrice_down__WC3cT)"
      );
      if (!priceElem) {
        throw new Error(
          "Could not find the correct price element in the target <li>"
        );
      }
      let priceStr = await priceElem.innerText();
      priceStr = priceStr.trim().replace(",", "."); // Convert comma to dot
      const price = parseFloat(priceStr);
      if (isNaN(price)) {
        throw new Error("Could not parse gold price");
      }
      goldPrice = price;
      console.log(`Gold price per gram updated: ${goldPrice.toFixed(2)} USD`);
      return; // Successful; exit the retry loop
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

  // Serve the frontend for any unknown route
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
