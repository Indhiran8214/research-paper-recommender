// ============================================================
// aiRankingService.js — Improved ranking with keyword title matching
// ============================================================

/**
 * Scores a paper based on:
 *  - Keyword matches in title (highest weight)
 *  - Keyword matches in abstract
 *  - Recency (year)
 *  - Citation count
 */
function scorePaper(paper, queryTerms) {
  const title    = (paper.title   || "").toLowerCase();
  const abstract = (paper.abstract || paper.summary || "").toLowerCase();

  let titleScore = 0;
  let abstractScore = 0;

  queryTerms.forEach(term => {
    const t = term.toLowerCase();
    // Title matches: strong signal
    if (title.includes(t)) titleScore += 10;
    // Partial word in title
    if (title.split(/\s+/).some(w => w.startsWith(t))) titleScore += 4;
    // Abstract matches
    const count = (abstract.match(new RegExp(t, "gi")) || []).length;
    abstractScore += count * 1.5;
  });

  // Recency score: favour papers from last 5 years
  const year = parseInt(paper.year) || 2000;
  const currentYear = new Date().getFullYear();
  const agePenalty = Math.max(0, currentYear - year);
  const recencyScore = Math.max(0, 20 - agePenalty * 1.5);

  // Citation score (log scale so outliers don't dominate)
  const citations = parseInt(paper.citationCount) || 0;
  const citationScore = citations > 0 ? Math.log10(citations + 1) * 3 : 0;

  return titleScore + abstractScore + recencyScore + citationScore;
}

async function rankPapersWithAI(papers, query) {
  if (!papers || papers.length === 0) return [];

  // Extract meaningful terms from query (skip common words)
  const stopwords = new Set(["a","an","the","and","or","of","in","for","on","with","to","by","from","using","based","via"]);
  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopwords.has(t));

  const ranked = papers
    .map(p => {
      const score = scorePaper(p, queryTerms);
      return {
        title:     p.title,
        year:      p.year,
        summary:   p.abstract || "No abstract available.",
        reason:    buildReason(p, queryTerms),
        citations: p.citationCount || 0,
        link:      p.url || "",
        authors:   p.authors || "Unknown",
        venue:     p.venue || "",
        _score:    score,
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
    .map(({ _score, ...rest }) => rest);

  return ranked;
}

function buildReason(paper, queryTerms) {
  const title = (paper.title || "").toLowerCase();
  const matches = queryTerms.filter(t => title.includes(t));
  const year = paper.year || "unknown year";
  const citations = parseInt(paper.citationCount) || 0;

  let reason = "";
  if (matches.length >= 2) {
    reason = `Directly addresses "${matches.slice(0,3).join(", ")}" in the title.`;
  } else if (matches.length === 1) {
    reason = `Title includes the key term "${matches[0]}".`;
  } else {
    reason = "Highly relevant to the search topic based on abstract analysis.";
  }

  if (citations > 100) reason += ` Widely cited (${citations.toLocaleString()} citations).`;
  else if (citations > 10) reason += ` Has notable citations (${citations}).`;

  const currentYear = new Date().getFullYear();
  if (parseInt(year) >= currentYear - 2) reason += " Recent publication.";

  return reason;
}

module.exports = { rankPapersWithAI };
