# Gilded Promise – Product List
Gilded Promise – Product List is a full‑stack product listing application that dynamically calculates product prices based on the live gold price scraped from Kitco. The application features interactive filtering, ordering, and a responsive product carousel. It is built with Node.js, Express, and Playwright for the backend, and plain HTML, CSS, and JavaScript for the frontend.

# Features:

Live Gold Pricing:
The backend uses Playwright to scrape the current gold price (USD per gram) from Kitco every minute. If scraping fails, it falls back to a default value.

Dynamic Pricing Calculation:
Product prices are computed using the formula:
Price = (popularityScore + 1) * weight * goldPrice
Prices are rounded to the nearest whole number.

Filtering & Ordering:
Users can filter products by price and rating (0–5) and order them by price, rating, or the rating/price ratio.

Interactive UI:
The frontend displays products in a horizontally scrollable carousel with dynamic color switching and a responsive design.

Branding:
The header includes a custom logo and brand name ("Gilded Promise") along with a subheading ("Product List").

# Getting Started
## 1. Clone the Repository
To work on the project locally, start by cloning the repository from GitHub:

git clone https://github.com/mertkuleci/gilded-promise.git

cd gilded-promise


## 2. Install Dependencies

npm install

A postinstall script automatically runs npx playwright install to download the required browser binaries for Playwright.

## 3. Running the Project Locally
Start the backend and frontend at the same time:

npm start

It will listen on process.env.PORT || 3001. You can then access the API endpoints locally (for example, by visiting http://localhost:3001/api/products).


# Deployment
This project is deployed using Docker on Render. The Dockerfile uses the official Playwright image which includes all necessary browser dependencies.

# Backend & Frontend Deployed Link:
https://gilded-promise-1.onrender.com
Simply open the above URL in your browser to use the application. The deployed version scrapes the live gold price from Kitco and uses it to calculate product prices in real time.

# How It Works
Scraping with Playwright:
The backend periodically launches a headless Chromium browser (using Playwright) to navigate to Kitco’s gold charts page. It extracts the gold price (in USD per gram) from the page and caches it. This price is used in calculating product prices.

# API Endpoint:
The /api/products endpoint uses the cached gold price to compute each product’s price, applies filtering and ordering based on query parameters, and returns the product data as JSON.

# Frontend UI:
The frontend fetches data from the API and displays products in a responsive carousel. Users can filter and sort products using the sidebar.

# GitHub & Version Control
The project is maintained with Git for version control. You can review the commit history, branch, and contribute by forking the repository on GitHub:

[https://github.com/mertkuleci/gilded-promise](https://github.com/mertkuleci/gilded-promise/tree/master)


# Acknowledgments
Playwright: For the headless browser automation and scraping capabilities.
Kitco: For providing the live gold price data.
Render: For hosting the application.

İbrahim Mert Kuleci
