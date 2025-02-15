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

// Set executablePath from env variable or default to Render's installed Chrome path
const chromeExecutablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "/opt/render/.cache/puppeteer/chrome/linux-133.0.6943.98/chrome-linux64/chrome";

/**
 * Uses Puppeteer to launch a headless Chrome browser, navigates to Kitco,
 * finds the list item containing "gram", and extracts the gold price.
 */
async function updateGoldPrice() {
  let browser;
  try {
    // Launch Puppeteer with explicit executable path
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: chromeExecutablePath,
    });
    const page = await browser.newPage();
    await page.goto("https://www.kitco.com/charts/gold", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait for any <li> element with class "flex items-center" to appear
    await page.waitForSelector("li.flex.items-center", { timeout: 10000 });
    const liHandles = await page.$$("li.flex.items-center");

    let targetHandle = null;
    // Loop through li elements to find one whose child p element with
    // class "CommodityPrice_priceName__Ehicd" includes "gram"
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
        // Skip this element if error occurs
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
      throw new Error("Could not find price element in the 'gram' li");
    }
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
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
