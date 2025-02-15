/****************************************************************************
 * server.js
 * --------------------------------------------------------------------------
 * Node/Express backend that:
 * - Scrapes the live gold price (USD per gram) from Kitco using Selenium WebDriver.
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

// Require Selenium WebDriver and Chrome options
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Global variable to store the latest gold price per gram in USD
let goldPrice = 0;

/**
 * Uses Selenium to launch a headless Chrome browser, navigates to the Kitco gold charts page,
 * finds the list item with "gram" in its price name, and extracts the gold price.
 */
async function updateGoldPrice() {
  let driver;
  try {
    // Configure headless Chrome
    const options = new chrome.Options();
    options.addArguments(
      "--headless",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--ignore-certificate-errors"
    );

    // Build the driver
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    // Navigate to the Kitco gold charts page
    await driver.get("https://www.kitco.com/charts/gold");

    // Wait for any <li> element with class "flex items-center" to be present
    await driver.wait(
      until.elementLocated(By.css("li.flex.items-center")),
      10000
    );

    // Get all li elements with class "flex items-center"
    const liElements = await driver.findElements(
      By.css("li.flex.items-center")
    );

    let targetElement = null;
    // Loop through the li elements and check for one containing "gram" in its price name
    for (let li of liElements) {
      try {
        const priceNameElem = await li.findElement(
          By.css("p.CommodityPrice_priceName__Ehicd")
        );
        const priceName = (await priceNameElem.getText()).toLowerCase();
        if (priceName.includes("gram")) {
          targetElement = li;
          break;
        }
      } catch (e) {
        // If the element is not found in this li, skip it
      }
    }

    if (!targetElement) {
      throw new Error("Could not locate target element containing 'gram'");
    }

    // Within the target element, find the <p> with class "CommodityPrice_convertPrice__5Addh"
    const priceElem = await targetElement.findElement(
      By.css("p.CommodityPrice_convertPrice__5Addh")
    );
    let priceStr = await priceElem.getText();
    priceStr = priceStr.trim().replace(",", "."); // Convert comma to dot
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      throw new Error("Could not parse gold price");
    }
    goldPrice = price;
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
  } finally {
    if (driver) {
      await driver.quit();
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
