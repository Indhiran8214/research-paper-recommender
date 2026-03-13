// ============================================================
// server.js - Main Express server entry point
// ============================================================

require("dotenv").config(); // Load .env variables first

const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(cors());                              // Allow cross-origin requests
app.use(express.json());                      // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// ---- Static Files ----
// Serve the frontend files from the /public directory
app.use(express.static(path.join(__dirname, "../public")));

// ---- API Routes ----
app.use("/api", apiRoutes);

// ---- Frontend Routes ----
// Serve index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Serve results.html for /results
app.get("/results", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/results.html"));
});

// Serve bookmarks.html for /bookmarks
app.get("/bookmarks", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/bookmarks.html"));
});

// ---- 404 Fallback ----
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ---- Global Error Handler ----
app.use((err, req, res, next) => {
  console.error("[Server] Unhandled error:", err.stack);
  res.status(500).json({ error: "Internal server error." });
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   AI Research Paper Recommender — Running    ║");
  console.log(`║   → http://localhost:${PORT}                    ║`);
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? "✓ Configured" : "✗ NOT SET (check .env)"}`);
  console.log(`Semantic Scholar Key: ${process.env.SEMANTIC_SCHOLAR_API_KEY ? "✓ Configured" : "— (optional)"}`);
  console.log("");
});

module.exports = app;
