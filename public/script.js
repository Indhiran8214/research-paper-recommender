// ============================================================
// script.js — AI Research Paper Recommender (Enhanced v2)
// Features: Bookmarks, Notes, Compare, Filter/Sort, History
// ============================================================

const API_BASE = window.location.origin;

const isHomePage     = document.getElementById("search-input") !== null;
const isResultPage   = document.getElementById("results-container") !== null;
const isBookmarkPage = document.getElementById("bookmarks-container") !== null;

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem("scholarai_bookmarks") || "{}"); }
  catch { return {}; }
}
function saveBookmarks(data) { localStorage.setItem("scholarai_bookmarks", JSON.stringify(data)); }
function getNotes() {
  try { return JSON.parse(localStorage.getItem("scholarai_notes") || "{}"); }
  catch { return {}; }
}
function saveNotes(data) { localStorage.setItem("scholarai_notes", JSON.stringify(data)); }
function getSearchHistory() {
  try { return JSON.parse(localStorage.getItem("scholarai_history") || "[]"); }
  catch { return []; }
}
function saveSearchHistory(arr) { localStorage.setItem("scholarai_history", JSON.stringify(arr)); }
function addSearchHistory(query) {
  let hist = getSearchHistory();
  hist = [query, ...hist.filter(h => h !== query)].slice(0, 8);
  saveSearchHistory(hist);
}

// ============================================================
// NAVBAR BADGE
// ============================================================
function updateNavBadge() {
  const badge = document.getElementById("bookmark-badge");
  if (!badge) return;
  const count = Object.keys(getBookmarks()).length;
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

// ============================================================
// LOADING OVERLAY
// ============================================================
const LOADING_STEPS = [
  "Querying arXiv API...",
  "Fetching paper metadata...",
  "Ranking by relevance & recency...",
  "Filtering by keyword match...",
  "Finalizing top results...",
];
let loadingStepIndex = 0;
let loadingInterval  = null;

function showLoading() {
  const overlay = document.getElementById("loading-overlay");
  const stepEl  = document.getElementById("loading-step");
  if (overlay) overlay.classList.add("active");
  loadingStepIndex = 0;
  if (stepEl) stepEl.textContent = LOADING_STEPS[0];
  loadingInterval = setInterval(() => {
    loadingStepIndex = (loadingStepIndex + 1) % LOADING_STEPS.length;
    if (stepEl) stepEl.textContent = LOADING_STEPS[loadingStepIndex];
  }, 2500);
}
function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.remove("active");
  if (loadingInterval) clearInterval(loadingInterval);
}

// ============================================================
// HOMEPAGE
// ============================================================
function handleSearch() {
  const input = document.getElementById("search-input");
  if (!input) return;
  const query = input.value.trim();
  if (!query) { shakeElement(input); input.placeholder = "Please enter a search topic..."; return; }
  addSearchHistory(query);
  window.location.href = `/results?q=${encodeURIComponent(query)}`;
}

function setQuery(topic) {
  const input = document.getElementById("search-input");
  if (input) { input.value = topic; input.focus(); }
}

function renderSearchHistory() {
  const container = document.getElementById("search-history");
  if (!container) return;
  const hist = getSearchHistory();
  if (!hist.length) { container.style.display = "none"; return; }
  container.style.display = "flex";
  const pills = hist.map(h =>
    `<span class="tag-pill history-pill" onclick="setQuery(this.dataset.q)" data-q="${escapeHtml(h)}">${escapeHtml(h)}</span>`
  ).join("");
  container.innerHTML = `<span class="tags-label">Recent:</span>${pills}`;
  // wire up click
  container.querySelectorAll(".history-pill").forEach(pill => {
    pill.addEventListener("click", () => setQuery(pill.dataset.q));
  });
}

if (isHomePage) {
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("search-input");
    if (input) input.addEventListener("keydown", e => { if (e.key === "Enter") handleSearch(); });
    updateNavBadge();
    renderSearchHistory();
  });
}

// ============================================================
// RESULTS PAGE — FETCH & RENDER
// ============================================================
let allPapers = [];
let compareMode = false;
let compareSelected = [];

function handleResultsSearch() {
  const input = document.getElementById("results-search-input");
  if (!input) return;
  const query = input.value.trim();
  if (!query) { shakeElement(input); return; }
  addSearchHistory(query);
  window.location.href = `/results?q=${encodeURIComponent(query)}`;
}

async function loadResults() {
  const urlParams  = new URLSearchParams(window.location.search);
  const query      = urlParams.get("q")?.trim();

  const queryDisplay = document.getElementById("query-display");
  const metaEl       = document.getElementById("results-meta");
  const headingEl    = document.getElementById("results-heading");
  const searchInput  = document.getElementById("results-search-input");

  if (queryDisplay) queryDisplay.textContent = query || "—";
  if (searchInput)  searchInput.value = query || "";
  if (headingEl)    headingEl.innerHTML = `Results for: <span class="query-text">${escapeHtml(query || "")}</span>`;
  if (searchInput) searchInput.addEventListener("keydown", e => { if (e.key === "Enter") handleResultsSearch(); });

  if (!query) { renderError("No search query provided.", "Please go back and enter a topic."); return; }

  showLoading();
  if (metaEl) metaEl.textContent = `Searching for "${query}"...`;

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_BASE}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    hideLoading();

    if (!response.ok || data.error) {
      renderError("Search Failed", data.error || `Server returned status ${response.status}`);
      if (metaEl) metaEl.textContent = "Search failed.";
      return;
    }
    if (!data.papers || data.papers.length === 0) {
      renderEmpty(query);
      if (metaEl) metaEl.textContent = "No papers found.";
      return;
    }

    allPapers = data.papers;
    if (metaEl) metaEl.textContent = `${data.papers.length} AI-ranked papers · ${elapsed}s · from ${data.totalFetched || "?"} fetched`;

    renderFilterBar(query);
    renderPapers(allPapers);
    updateNavBadge();

  } catch (error) {
    hideLoading();
    console.error("[Script] Fetch error:", error);
    renderError("Network Error", "Could not connect to the server.");
  }
}

// ============================================================
// FILTER BAR
// ============================================================
function renderFilterBar(query) {
  const resultsArea = document.getElementById("results-container");
  if (!resultsArea || document.getElementById("filter-bar")) return;

  const filterBar = document.createElement("div");
  filterBar.id = "filter-bar";
  filterBar.className = "filter-bar";
  filterBar.innerHTML = `
    <div class="filter-controls">
      <div class="filter-group">
        <label>Sort by</label>
        <select id="sort-select" onchange="applyFilters()">
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="abstract">Abstract Quality</option>
        </select>
      </div>
      <div class="filter-group">
        <label>From year</label>
        <input type="number" id="year-from" placeholder="e.g. 2018" min="1990" max="2025" oninput="applyFilters()" />
      </div>
      <div class="filter-group">
        <label>To year</label>
        <input type="number" id="year-to" placeholder="e.g. 2024" min="1990" max="2025" oninput="applyFilters()" />
      </div>
      <div class="filter-actions">
        <button class="btn-compare-mode" id="compare-mode-btn" onclick="toggleCompareMode()">
          <i class="fa-solid fa-table-columns"></i> Compare Mode
        </button>
        <button class="btn-export-small" onclick="exportBibTeX(allPapers, '${escapeHtml(query)}')">
          <i class="fa-solid fa-file-code"></i> BibTeX
        </button>
        <button class="btn-export-small" onclick="exportCSV(allPapers, '${escapeHtml(query)}')">
          <i class="fa-solid fa-file-csv"></i> CSV
        </button>
      </div>
    </div>
    <div id="compare-instructions" class="compare-instructions" style="display:none">
      <i class="fa-solid fa-circle-info"></i> Select 2–3 papers to compare, then click <strong>View Side-by-Side</strong>
      <button class="btn-view-compare" id="view-compare-btn" onclick="openCompareModal()" style="display:none">
        <i class="fa-solid fa-eye"></i> View Side-by-Side
      </button>
    </div>
  `;
  resultsArea.parentNode.insertBefore(filterBar, resultsArea);
}

function applyFilters() {
  renderPapers(getFilteredPapers());
}

function getFilteredPapers() {
  const sort     = document.getElementById("sort-select")?.value || "relevance";
  const fromYear = parseInt(document.getElementById("year-from")?.value) || 0;
  const toYear   = parseInt(document.getElementById("year-to")?.value)   || 9999;

  let filtered = allPapers.filter(p => {
    const y = parseInt(p.year) || 0;
    return (!fromYear || y >= fromYear) && (!toYear || y <= toYear);
  });

  if (sort === "newest")   filtered = [...filtered].sort((a,b) => (b.year||0) - (a.year||0));
  else if (sort === "oldest")   filtered = [...filtered].sort((a,b) => (a.year||0) - (b.year||0));
  else if (sort === "abstract") filtered = [...filtered].sort((a,b) => (b.summary?.length||0) - (a.summary?.length||0));

  return filtered;
}

// ============================================================
// COMPARE MODE
// ============================================================
function toggleCompareMode() {
  compareMode = !compareMode;
  compareSelected = [];
  const btn  = document.getElementById("compare-mode-btn");
  const inst = document.getElementById("compare-instructions");
  if (btn) {
    btn.classList.toggle("active", compareMode);
    btn.innerHTML = compareMode
      ? '<i class="fa-solid fa-xmark"></i> Exit Compare'
      : '<i class="fa-solid fa-table-columns"></i> Compare Mode';
  }
  if (inst) inst.style.display = compareMode ? "flex" : "none";
  renderPapers(getFilteredPapers());
}

function toggleCompareSelect(paperId) {
  const idx = compareSelected.indexOf(paperId);
  if (idx > -1) {
    compareSelected.splice(idx, 1);
  } else {
    if (compareSelected.length >= 3) { alert("You can compare up to 3 papers at a time."); return; }
    compareSelected.push(paperId);
  }
  const viewBtn = document.getElementById("view-compare-btn");
  if (viewBtn) viewBtn.style.display = compareSelected.length >= 2 ? "inline-flex" : "none";
  document.querySelectorAll(".paper-card").forEach(card => {
    card.classList.toggle("compare-selected", compareSelected.includes(card.dataset.paperId));
  });
  document.querySelectorAll(".btn-compare-select").forEach(btn => {
    const sel = compareSelected.includes(btn.dataset.paperId);
    btn.innerHTML = sel ? '<i class="fa-solid fa-check-square"></i> Selected' : '<i class="fa-regular fa-square"></i> Compare';
    btn.classList.toggle("selected", sel);
  });
}

function openCompareModal() {
  if (compareSelected.length < 2) return;
  const papers = compareSelected.map(id => allPapers.find(p => makePaperId(p) === id)).filter(Boolean);
  const modal = document.getElementById("compare-modal");
  const body  = document.getElementById("compare-modal-body");
  if (!modal || !body) return;

  const thCols = papers.map(p =>
    `<th><div class="cmp-title">${escapeHtml(truncate(p.title,70))}</div><a href="${escapeHtml(p.link||"#")}" target="_blank" class="cmp-link">View Paper ↗</a></th>`
  ).join("");

  const row = (label, fn) =>
    `<tr><td class="cmp-label">${label}</td>${papers.map(p => `<td>${escapeHtml(String(fn(p)||"N/A"))}</td>`).join("")}</tr>`;

  body.innerHTML = `
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead><tr><th>Field</th>${thCols}</tr></thead>
        <tbody>
          ${row("Year",       p => p.year)}
          ${row("Authors",    p => p.authors)}
          ${row("Venue",      p => p.venue)}
          ${row("Citations",  p => typeof p.citations === "number" ? p.citations.toLocaleString() : "N/A")}
          ${row("Abstract",   p => (p.summary||"").substring(0,280)+"…")}
          ${row("Why recommended", p => p.reason)}
        </tbody>
      </table>
    </div>`;

  modal.classList.add("active");
}

function closeCompareModal() {
  const modal = document.getElementById("compare-modal");
  if (modal) modal.classList.remove("active");
}

// ============================================================
// BOOKMARKS
// ============================================================
function makePaperId(paper) {
  return btoa(encodeURIComponent((paper.title || "").substring(0, 80))).replace(/[+=]/g,"");
}

function toggleBookmark(paper, btn) {
  const bookmarks = getBookmarks();
  const id = makePaperId(paper);
  if (bookmarks[id]) {
    delete bookmarks[id];
    btn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Save';
    btn.classList.remove("bookmarked");
  } else {
    bookmarks[id] = { ...paper, savedAt: new Date().toISOString(), id };
    btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved';
    btn.classList.add("bookmarked");
  }
  saveBookmarks(bookmarks);
  updateNavBadge();
}

function isBookmarked(paper) {
  return !!getBookmarks()[makePaperId(paper)];
}

// ============================================================
// NOTES MODAL
// ============================================================
function openNotesModal(paper) {
  const modal    = document.getElementById("notes-modal");
  const titleEl  = document.getElementById("notes-modal-title");
  const textarea = document.getElementById("notes-textarea");
  const saveBtn  = document.getElementById("notes-save-btn");
  if (!modal) return;

  const id    = makePaperId(paper);
  const notes = getNotes();
  if (titleEl)  titleEl.textContent = truncate(paper.title, 70);
  if (textarea) textarea.value = notes[id] || "";
  modal.classList.add("active");
  modal.dataset.paperId = id;

  if (saveBtn) saveBtn.onclick = () => {
    const allNotes = getNotes();
    const val = textarea ? textarea.value.trim() : "";
    if (val) allNotes[id] = val;
    else delete allNotes[id];
    saveNotes(allNotes);
    modal.classList.remove("active");
    const previewEl = document.querySelector(`.note-preview[data-paper-id="${id}"]`);
    if (previewEl) {
      previewEl.textContent = val ? "📝 " + truncate(val, 80) : "";
      previewEl.style.display = val ? "block" : "none";
    }
  };
  if (textarea) setTimeout(() => textarea.focus(), 100);
}

function closeNotesModal() {
  const modal = document.getElementById("notes-modal");
  if (modal) modal.classList.remove("active");
}

// ============================================================
// RENDERING
// ============================================================
function renderPapers(papers) {
  const container = document.getElementById("results-container");
  if (!container) return;
  container.innerHTML = "";
  if (!papers.length) {
    container.innerHTML = `<div class="state-card"><div class="state-icon">🔍</div><div class="state-title">No papers match your filters</div><div class="state-text">Try adjusting the year range or sort order.</div></div>`;
    return;
  }
  papers.forEach((paper, index) => container.appendChild(createPaperCard(paper, index + 1)));
}

function createPaperCard(paper, rank) {
  const card = document.createElement("div");
  card.className = "paper-card";
  const id = makePaperId(paper);
  card.dataset.paperId = id;

  if (compareMode && compareSelected.includes(id)) card.classList.add("compare-selected");

  const citations  = typeof paper.citations === "number" ? paper.citations.toLocaleString() : "N/A";
  const authors    = paper.authors ? truncate(paper.authors, 60) : "Unknown Authors";
  const venueBadge = paper.venue
    ? `<span class="meta-badge meta-venue"><i class="fa-solid fa-building-columns" style="font-size:0.7rem"></i>${escapeHtml(paper.venue)}</span>` : "";
  const bookmarked = isBookmarked(paper);
  const notes      = getNotes();
  const noteText   = notes[id] || "";

  const compareBtn = compareMode
    ? `<button class="btn-compare-select${compareSelected.includes(id) ? " selected" : ""}" data-paper-id="${id}">
        <i class="fa-${compareSelected.includes(id) ? "solid fa-check-square" : "regular fa-square"}"></i>
        ${compareSelected.includes(id) ? "Selected" : "Compare"}
       </button>` : "";

  card.innerHTML = `
    <div class="paper-rank">#${rank}</div>
    <div class="paper-title">${escapeHtml(paper.title || "Untitled Paper")}</div>
    <div class="paper-meta">
      <span class="meta-badge meta-year"><i class="fa-solid fa-calendar-days" style="font-size:0.7rem"></i>${escapeHtml(String(paper.year || "N/A"))}</span>
      <span class="meta-badge meta-citations"><i class="fa-solid fa-star" style="font-size:0.7rem"></i>${citations} citations</span>
      <span class="meta-badge meta-authors"><i class="fa-solid fa-users" style="font-size:0.7rem"></i>${escapeHtml(authors)}</span>
      ${venueBadge}
    </div>
    <div class="paper-summary">${escapeHtml(paper.summary || "No summary available.")}</div>
    <div class="paper-reason">
      <span class="reason-icon"><i class="fa-solid fa-lightbulb"></i></span>
      <span class="reason-text"><strong>Why recommended:</strong> ${escapeHtml(paper.reason || "Relevant to the search query.")}</span>
    </div>
    <div class="note-preview" data-paper-id="${id}" style="display:${noteText ? "block" : "none"}">${noteText ? "📝 " + escapeHtml(truncate(noteText, 80)) : ""}</div>
    <div class="paper-actions">
      <a href="${escapeHtml(paper.link || "#")}" target="_blank" rel="noopener noreferrer" class="btn-read-paper"
        ${!paper.link ? 'onclick="return false;" style="opacity:0.5;cursor:not-allowed"' : ""}>
        <i class="fa-solid fa-arrow-up-right-from-square"></i> View Paper
      </a>
      <button class="btn-copy-link" data-link="${escapeHtml(paper.link || "")}">
        <i class="fa-regular fa-copy"></i> Copy Link
      </button>
      <button class="btn-bookmark${bookmarked ? " bookmarked" : ""}">
        <i class="fa-${bookmarked ? "solid" : "regular"} fa-bookmark"></i> ${bookmarked ? "Saved" : "Save"}
      </button>
      <button class="btn-note">
        <i class="fa-regular fa-note-sticky"></i> Note
      </button>
      ${compareBtn}
    </div>
  `;

  card.querySelector(".btn-copy-link").onclick = function() { copyLink(paper.link || "", this); };
  card.querySelector(".btn-bookmark").onclick  = function() { toggleBookmark(paper, this); };
  card.querySelector(".btn-note").onclick      = function() { openNotesModal(paper); };

  if (compareMode) {
    const cmpBtn = card.querySelector(".btn-compare-select");
    if (cmpBtn) cmpBtn.onclick = () => toggleCompareSelect(id);
  }

  return card;
}

function renderEmpty(query) {
  const container = document.getElementById("results-container");
  if (!container) return;
  container.innerHTML = `<div class="state-card"><div class="state-icon">🔍</div><div class="state-title">No papers found</div><div class="state-text">We couldn't find any papers matching <strong>"${escapeHtml(query)}"</strong>. Try a broader term.</div><a href="/" style="margin-top:1.5rem;display:inline-block;color:var(--brass)">← Back to Search</a></div>`;
}

function renderError(title, message) {
  const container = document.getElementById("results-container");
  if (!container) return;
  container.innerHTML = `<div class="error-card"><div class="state-icon" style="color:#b91c1c">⚠️</div><div class="error-title">${escapeHtml(title)}</div><div class="error-msg">${escapeHtml(message)}</div><a href="/" style="margin-top:1.2rem;display:inline-block;color:var(--navy);font-size:0.875rem">← Back to Search</a></div>`;
}

// ============================================================
// BOOKMARKS PAGE
// ============================================================
function renderBookmarksPage() {
  const container = document.getElementById("bookmarks-container");
  const countEl   = document.getElementById("bookmarks-count");
  if (!container) return;

  const bookmarks = getBookmarks();
  const papers = Object.values(bookmarks).sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));

  if (countEl) countEl.textContent = `${papers.length} saved paper${papers.length !== 1 ? "s" : ""}`;

  if (!papers.length) {
    container.innerHTML = `<div class="state-card"><div class="state-icon">📌</div><div class="state-title">No saved papers yet</div><div class="state-text">Use the <strong>Save</strong> button on any paper to bookmark it here.</div><a href="/" style="margin-top:1.5rem;display:inline-block;color:var(--brass)">← Search Papers</a></div>`;
    return;
  }

  container.innerHTML = "";
  papers.forEach((paper, i) => container.appendChild(createBookmarkCard(paper, i + 1)));
}

function createBookmarkCard(paper, rank) {
  const card = document.createElement("div");
  card.className = "paper-card";
  const id        = makePaperId(paper);
  card.dataset.paperId = id;
  const citations = typeof paper.citations === "number" ? paper.citations.toLocaleString() : "N/A";
  const authors   = paper.authors ? truncate(paper.authors, 60) : "Unknown Authors";
  const notes     = getNotes();
  const noteText  = notes[id] || "";
  const savedDate = paper.savedAt ? new Date(paper.savedAt).toLocaleDateString() : "Unknown";

  card.innerHTML = `
    <div class="paper-rank">#${rank}</div>
    <div class="paper-title">${escapeHtml(paper.title || "Untitled Paper")}</div>
    <div class="paper-meta">
      <span class="meta-badge meta-year"><i class="fa-solid fa-calendar-days" style="font-size:0.7rem"></i>${escapeHtml(String(paper.year || "N/A"))}</span>
      <span class="meta-badge meta-citations"><i class="fa-solid fa-star" style="font-size:0.7rem"></i>${citations} citations</span>
      <span class="meta-badge meta-authors"><i class="fa-solid fa-users" style="font-size:0.7rem"></i>${escapeHtml(authors)}</span>
      <span class="meta-badge" style="background:rgba(201,168,76,0.1);border-color:rgba(201,168,76,0.35);color:#8a6e1e">
        <i class="fa-solid fa-clock" style="font-size:0.7rem"></i> Saved ${savedDate}
      </span>
    </div>
    <div class="paper-summary">${escapeHtml(paper.summary || "No summary available.")}</div>
    ${noteText ? `<div class="note-preview" data-paper-id="${id}">📝 ${escapeHtml(truncate(noteText, 120))}</div>` : ""}
    <div class="paper-actions">
      <a href="${escapeHtml(paper.link || "#")}" target="_blank" rel="noopener noreferrer" class="btn-read-paper"
        ${!paper.link ? 'onclick="return false;" style="opacity:0.5;cursor:not-allowed"' : ""}>
        <i class="fa-solid fa-arrow-up-right-from-square"></i> View Paper
      </a>
      <button class="btn-note"><i class="fa-regular fa-note-sticky"></i> Note</button>
      <button class="btn-remove-bookmark"><i class="fa-solid fa-trash"></i> Remove</button>
    </div>
  `;

  card.querySelector(".btn-note").onclick = () => openNotesModal(paper);
  card.querySelector(".btn-remove-bookmark").onclick = () => {
    const bm = getBookmarks();
    delete bm[id];
    saveBookmarks(bm);
    updateNavBadge();
    card.style.transition = "opacity 0.3s ease";
    card.style.opacity = "0";
    setTimeout(() => { card.remove(); renderBookmarksPage(); }, 300);
  };

  return card;
}

// ============================================================
// EXPORT
// ============================================================
function exportBibTeX(papers, query) {
  if (!papers || !papers.length) return;
  let bib = "";
  papers.forEach((p, i) => {
    const key = `paper${i+1}_${(p.year||"0000")}`;
    bib += `@article{${key},\n  title   = {${(p.title||"").replace(/[{}]/g,"")}},\n  author  = {${(p.authors||"Unknown")}},\n  year    = {${p.year||""}},\n  journal = {${p.venue||"arXiv"}},\n  url     = {${p.link||""}},\n  note    = {Recommended for query: ${query}}\n}\n\n`;
  });
  downloadFile("papers.bib", bib, "text/plain");
}

function exportCSV(papers, query) {
  if (!papers || !papers.length) return;
  const headers = ["Rank","Title","Authors","Year","Venue","Citations","Link","Why Recommended"];
  const rows = papers.map((p, i) => [
    i+1,
    `"${(p.title||"").replace(/"/g,'""')}"`,
    `"${(p.authors||"").replace(/"/g,'""')}"`,
    p.year||"",
    `"${(p.venue||"").replace(/"/g,'""')}"`,
    p.citations||0,
    p.link||"",
    `"${(p.reason||"").replace(/"/g,'""')}"`
  ].join(","));
  downloadFile("papers.csv", [headers.join(","), ...rows].join("\n"), "text/csv");
}

function exportBookmarksBibTeX() {
  const papers = Object.values(getBookmarks());
  exportBibTeX(papers, "saved bookmarks");
}
function exportBookmarksCSV() {
  const papers = Object.values(getBookmarks());
  exportCSV(papers, "saved bookmarks");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ============================================================
// UTILITY
// ============================================================
function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function truncate(str, maxLength) {
  if (!str) return "";
  return str.length > maxLength ? str.substring(0, maxLength) + "…" : str;
}
function copyLink(url, btn) {
  if (!url || url === "#") {
    btn.textContent = "No link!";
    setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Link'; }, 1500);
    return;
  }
  navigator.clipboard.writeText(url).then(() => {
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    btn.style.borderColor = "var(--success)"; btn.style.color = "var(--success)";
    setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Link'; btn.style.borderColor = ""; btn.style.color = ""; }, 2000);
  });
}
function shakeElement(el) {
  el.style.borderColor = "#ef4444";
  setTimeout(() => { el.style.borderColor = ""; }, 1500);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  updateNavBadge();
  if (isResultPage)   loadResults();
  if (isBookmarkPage) renderBookmarksPage();
  document.querySelectorAll(".modal-overlay").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.remove("active"); });
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
  });
});
