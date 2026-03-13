// ============================================================
// routes.js - API route definitions for the backend
// ============================================================

const express = require("express");
const router = express.Router();
const { fetchPapers } = require("./paperService");
const { rankPapersWithAI } = require("./aiRankingService");

/**
 * POST /api/search
 * Main endpoint: accepts a query, fetches papers, returns AI-ranked top 5
 * Body: { query: "your research topic" }
 */
router.post("/search", async (req, res) => {
  const { query } = req.body;

  // ---- Input Validation ----
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({
      error: "A valid search query is required.",
    });
  }

  const sanitizedQuery = query.trim().substring(0, 200); // Max 200 chars

  console.log(`\n[Routes] New search request: "${sanitizedQuery}"`);

  try {
    // Step 1: Fetch raw papers from Semantic Scholar
    console.log("[Routes] Step 1: Fetching papers from Semantic Scholar...");
    const rawPapers = await fetchPapers(sanitizedQuery, 15);

    if (rawPapers.length === 0) {
      return res.status(200).json({
        papers: [],
        message: "No papers found for this query. Try a different search term.",
      });
    }

    // Step 2: AI ranks and filters to top 5
    console.log("[Routes] Step 2: Sending to AI for ranking...");
    const rankedPapers = await rankPapersWithAI(rawPapers, sanitizedQuery);

    // Step 3: Return results to frontend
    console.log(`[Routes] Done! Returning ${rankedPapers.length} ranked papers.\n`);
    return res.status(200).json({
      papers: rankedPapers,
      query: sanitizedQuery,
      totalFetched: rawPapers.length,
    });

  } catch (error) {
    console.error("[Routes] Error during search:", error.message);
    return res.status(500).json({
      error: error.message || "An unexpected server error occurred.",
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint to verify the server is running
 */
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    openAiConfigured: !!process.env.OPENAI_API_KEY,
    semanticScholarKey: !!process.env.SEMANTIC_SCHOLAR_API_KEY,
  });
});

module.exports = router;
