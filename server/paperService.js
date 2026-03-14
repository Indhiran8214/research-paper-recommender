// ============================================================
// paperService.js - Fetches papers from Semantic Scholar API
// ============================================================

const axios = require("axios");

const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPapers(query, limit = 15, retries = 3) {
  const params = {
    query,
    limit,
    fields: "title,abstract,year,citationCount,authors,venue,externalIds,openAccessPdf,url"
  };

  const headers = { "User-Agent": "research-paper-recommender/2.0" };

  // Use API key if provided in .env
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[paperService] Querying Semantic Scholar for: "${query}"`);

      const response = await axios.get(S2_API, {
        params,
        headers,
        timeout: 20000
      });

      const items = response.data?.data || [];
      console.log(`[paperService] Got ${items.length} results.`);

      return items.map(paper => ({
        title:         paper.title || "Untitled",
        abstract:      (paper.abstract || "").substring(0, 600),
        year:          paper.year || "N/A",
        citationCount: paper.citationCount || 0,
        authors:       paper.authors
          ? paper.authors.slice(0, 3).map(a => a.name).join(", ")
          : "Unknown",
        venue: paper.venue || "Unknown",
        url:   paper.openAccessPdf?.url
               || (paper.externalIds?.ArXiv ? `https://arxiv.org/abs/${paper.externalIds.ArXiv}` : "")
               || paper.url
               || ""
      }));

    } catch (error) {
      const status = error.response?.status;
      console.error(`[paperService] Attempt ${attempt} failed — ${status || error.message}`);

      if (status === 429) {
        const delay = 4000 * attempt;
        console.log(`[paperService] Rate limited. Waiting ${delay}ms...`);
        await wait(delay);
      } else if (attempt < retries) {
        await wait(1500);
      } else {
        throw new Error(`Failed to fetch papers (status ${status || "unknown"}).`);
      }
    }
  }

  throw new Error("Failed to fetch papers after multiple attempts.");
}

module.exports = { fetchPapers };