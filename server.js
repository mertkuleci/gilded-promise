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

async function fetchGoldPriceWithRetry(retries = 3) {
  let browser;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate with a shorter timeout and wait until DOMContentLoaded
      await page.goto("https://www.kitco.com/charts/gold", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Wait for list items to appear
      await page.waitForSelector("li.flex.items-center", { timeout: 15000 });
      const liElements = await page.$$("li.flex.items-center");

      let targetHandle = null;
      // Loop to find the <li> with a <p> whose text contains "gram"
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
          continue;
        }
      }

      if (!targetHandle) {
        throw new Error("Target element not found");
      }

      // Extract price from the designated <p> element
      const priceElem = await targetHandle.$(
        "p.CommodityPrice_convertPrice__5Addh"
      );
      if (!priceElem) {
        throw new Error("Price element not found");
      }
      let priceStr = await priceElem.innerText();
      priceStr = priceStr.trim().replace(",", "."); // Convert comma to dot
      const price = parseFloat(priceStr);
      if (isNaN(price)) {
        throw new Error("Could not parse gold price");
      }
      goldPrice = price;
      console.log(`Gold price per gram updated: ${goldPrice.toFixed(2)} USD`);
      return; // Success;
    } catch (err) {
      console.error(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) {
        if (!goldPrice) {
          goldPrice = 92.67;
        }
        console.warn(
          `Falling back to latest known gold price: ${goldPrice.toFixed(2)} USD`
        );
      }
    } finally {
      if (browser) await browser.close();
    }
  }
}

async function updateGoldPrice() {
  await fetchGoldPriceWithRetry();
}

async function startServer() {
  // Wait for the initial gold price update
  await updateGoldPrice();
  // Schedule subsequent updates every 1 minute
  setInterval(updateGoldPrice, 60000);

  // API endpoint for products
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

    // Apply filtering
    if (minPrice)
      result = result.filter((p) => p.price >= parseFloat(minPrice));
    if (maxPrice)
      result = result.filter((p) => p.price <= parseFloat(maxPrice));
    if (minRating)
      result = result.filter((p) => p.rating >= parseFloat(minRating));
    if (maxRating)
      result = result.filter((p) => p.rating <= parseFloat(maxRating));

    // Apply ordering
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

  // Serve frontend for any other routes
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
