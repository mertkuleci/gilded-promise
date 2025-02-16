// frontend-server.js (Frontend Server)
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8081;

// Serve static files from the "frontend" folder
app.use(express.static(path.join(__dirname, "frontend")));

// Catch-all route to serve index.html (supports client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
