// ============================================================
// paperService.js - Fetches research papers from arXiv API
// ============================================================

const axios = require("axios");
const xml2js = require("xml2js");

const ARXIV_API = "https://export.arxiv.org/api/query";

async function fetchPapers(query, limit = 5) {
  try {
    const url = `${ARXIV_API}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;

    const response = await axios.get(url);

    const parsed = await xml2js.parseStringPromise(response.data);

    const entries = parsed.feed.entry || [];

    const papers = entries.map((paper) => ({
      title: paper.title[0].trim(),
      abstract: paper.summary[0].trim().substring(0, 600),
      year: paper.published[0].substring(0, 4),
      citationCount: 0,
      authors: paper.author
        ? paper.author.map(a => a.name[0]).slice(0,3).join(", ")
        : "Unknown",
      venue: "arXiv",
      url: paper.id[0]
    }));

    return papers;

  } catch (error) {
    console.error("arXiv API error:", error.message);
    throw new Error("Failed to fetch papers from arXiv.");
  }
}

module.exports = { fetchPapers };