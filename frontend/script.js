/****************************************************************************
 * script.js
 * --------------------------------------------------------------------------
 * Fetches products from the backend, creates product cards, handles color
 * switching, implements carousel navigation, and applies filter and ordering
 * settings (including rating 0–5). Includes a loading overlay during fetch
 * and displays a message if no products are found.
 ****************************************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  const productContainer = document.getElementById("product-carousel");
  const prevButton = document.getElementById("prev");
  const nextButton = document.getElementById("next");
  const filterButton = document.getElementById("filterButton");
  const loadingOverlay = document.getElementById("loading");

  // Show/hide loading overlay
  function showLoading() {
    loadingOverlay.style.display = "flex";
  }
  function hideLoading() {
    loadingOverlay.style.display = "none";
  }

  // Helper: Convert numeric rating (e.g., 4.3) to star symbols with colored spans
  function getStarRating(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    let stars = "";
    for (let i = 0; i < fullStars; i++) {
      stars += '<span class="star">★</span>';
    }
    if (halfStar) {
      stars += '<span class="star">★</span>';
    }
    for (let i = 0; i < emptyStars; i++) {
      stars += '<span class="star">☆</span>';
    }
    return stars;
  }

  // Render products into the carousel
  function renderProducts(products) {
    const carouselNav = document.querySelector(".carousel-nav");
    productContainer.innerHTML = "";
    if (products.length === 0) {
      carouselNav.style.display = "none";
      productContainer.innerHTML = `<div class="no-products">No products found matching your criteria.</div>`;
      return;
    } else {
      carouselNav.style.display = "flex";
    }
    products.forEach((product) => {
      const card = document.createElement("div");
      card.className = "product-card";
      const defaultColor = "yellow";
      const productImage = product.images[defaultColor];

      const starMarkup = getStarRating(product.rating);
      const ratingText = `(${product.rating}/5)`;

      card.innerHTML = `
        <img src="${productImage}" alt="${product.name}" class="product-image">
        <h2 class="product-title">${product.name}</h2>
        <p class="product-price">$${product.price} USD</p>
        <p class="product-color-label">Yellow Gold</p>
        <p class="product-rating">
          ${starMarkup}
          <span style="margin-left:6px;">${ratingText}</span>
        </p>
        <div class="color-picker">
          <button data-color="yellow" style="background-color: #E6CA97;" title="Yellow Gold"></button>
          <button data-color="rose" style="background-color: #E1A4A9;" title="Rose Gold"></button>
          <button data-color="white" style="background-color: #D9D9D9;" title="White Gold"></button>
        </div>
      `;

      const colorButtons = card.querySelectorAll(".color-picker button");
      const imageEl = card.querySelector(".product-image");
      const colorLabel = card.querySelector(".product-color-label");
      colorButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const color = btn.getAttribute("data-color");
          imageEl.src = product.images[color];
          if (color === "yellow") colorLabel.textContent = "Yellow Gold";
          else if (color === "rose") colorLabel.textContent = "Rose Gold";
          else if (color === "white") colorLabel.textContent = "White Gold";
        });
      });

      productContainer.appendChild(card);
    });
  }

  // Fetch products from backend with optional filters and ordering
  async function fetchProducts(filters = {}) {
    showLoading();
    let query = "";
    const params = new URLSearchParams();
    if (filters.minPrice) params.append("minPrice", filters.minPrice);
    if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
    if (filters.minRating) params.append("minRating", filters.minRating);
    if (filters.maxRating) params.append("maxRating", filters.maxRating);
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if ([...params].length > 0) {
      query = "?" + params.toString();
    }
    try {
      const response = await fetch(
        "https://gilded-promise.onrender.com" + query
      );
      const products = await response.json();
      renderProducts(products);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      hideLoading();
    }
  }

  // Initial load
  fetchProducts();

  // Filter button event handler
  filterButton.addEventListener("click", () => {
    const minPrice = document.getElementById("minPrice").value;
    const maxPrice = document.getElementById("maxPrice").value;
    const minRating = document.getElementById("minRating").value;
    const maxRating = document.getElementById("maxRating").value;
    const sortBy = document.getElementById("orderBy").value;
    const filters = {
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      minRating: minRating || undefined,
      maxRating: maxRating || undefined,
      sortBy: sortBy || undefined,
    };
    fetchProducts(filters);
  });

  // Carousel navigation
  prevButton.addEventListener("click", () => {
    productContainer.scrollBy({
      left: -320,
      behavior: "smooth",
    });
  });

  nextButton.addEventListener("click", () => {
    productContainer.scrollBy({
      left: 320,
      behavior: "smooth",
    });
  });
});
