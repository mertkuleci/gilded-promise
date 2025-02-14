/****************************************************************************
 * frontend-server.js
 * --------------------------------------------------------------------------
 * A simple Express server that serves the static files from the 'frontend'
 * folder on port 8081.
 ****************************************************************************/
const express = require("express");
const path = require("path");

const app = express();
const PORT = 8081;

// Serve static files from the "frontend" folder
app.use(express.static(path.join(__dirname, "frontend")));

app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
});
