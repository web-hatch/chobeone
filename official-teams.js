const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzi2CP7aG4bbH9fL5ZRqwtq-O10W9zK_COYd6VNhsjCtWbJxKpBQsuMlLlxME5Sdpbl/exec";
const MAX_TEAMS_PER_CATEGORY = 16;
const CATEGORIES = [
  "Novice Low Men's Doubles",
  "Novice High Men's Doubles",
  "Novice Low Women's Doubles",
  "Novice High Women's Doubles",
  "Novice Low Mixed Doubles",
  "Novice High Mixed Doubles",
  "Open Doubles"
];

// DOM Selectors
const categoryGrid = document.querySelector("#officialCategoryGrid");
const totalTeams = document.querySelector("#officialTotalTeams");
const officialActiveCategories = document.querySelector("#officialActiveCategories");
const duplicateRemovedCount = document.querySelector("#duplicateRemovedCount");
const officialSlotsText = document.querySelector("#officialSlotsText");
const auditToggleBtn = document.querySelector("#auditToggleBtn");
const removedDuplicatesPanel = document.querySelector("#removedDuplicatesPanel");
const removedDuplicatesList = document.querySelector("#removedDuplicatesList");
const closeAuditBtn = document.querySelector("#closeAuditBtn");
const rosterSearchInput = document.querySelector("#rosterSearchInput");
const clearSearchBtn = document.querySelector("#clearSearchBtn");
const categoryFilterBar = document.querySelector("#categoryFilterBar");
const refreshButton = document.querySelector("#refreshTeamsBtn");
const toastContainer = document.querySelector("#toastContainer");

// Application State
let allOfficialTeamsByCategory = {};
let registrationOpen = true;
let duplicateEntryAllowed = false;
let removedDuplicates = [];
let activeCategoryFilter = "all";
let searchQuery = "";
let isAuditOpen = false;

/* ==========================================================================
   Helper Functions (Formatting & Normalization)
   ========================================================================== */
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function getCategoryDisplayName(categoryName) {
  return categoryName === "Open Doubles"
    ? "Open Doubles (Intermediate & Advance)"
    : categoryName;
}

function getCategoryDivisionBadge(categoryName) {
  if (categoryName.includes("Men's")) return "Men's Doubles";
  if (categoryName.includes("Women's")) return "Women's Doubles";
  if (categoryName.includes("Mixed")) return "Mixed Doubles";
  return "Open Doubles";
}

function normalizeName(str) {
  if (!str || typeof str !== "string") return "";
  const cleaned = str.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  return words.filter((w, idx) => {
    if (words.length <= 1) return true;
    return !(w.length === 1 && idx > 0 && idx < words.length - 1);
  }).join(" ");
}

function toProperCase(str) {
  if (!str || typeof str !== "string") return "";
  const words = str.trim().split(/\s+/);
  return words.map((w, index) => {
    const upper = w.toUpperCase();
    if (index > 0 && (upper === "AND" || upper === "&")) return upper === "AND" ? "and" : "&";
    if (/^[A-Z]\.?$/i.test(w)) return w.toUpperCase().replace(/\.?$/, ".");
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

/* ==========================================================================
   Centralized Floating Toast Notification
   ========================================================================== */
function showToast(type, message, duration = 4000) {
  if (!toastContainer) return;

  const icons = {
    success: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
    error: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    info: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <div class="toast-body">
      <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
  `;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });
  });

  const dismissToast = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  };

  toast.querySelector(".toast-close").addEventListener("click", dismissToast);
  setTimeout(dismissToast, duration);
}

/* ==========================================================================
   Skeleton Loading State
   ========================================================================== */
function renderSkeleton() {
  if (!categoryGrid) return;
  categoryGrid.innerHTML = Array.from({ length: 6 }, () => `
    <article class="official-category-card skeleton-official-card">
      <div class="skeleton-shimmer official-skeleton-title"></div>
      <div class="skeleton-shimmer official-skeleton-meter"></div>
      <div class="skeleton-shimmer official-skeleton-row"></div>
      <div class="skeleton-shimmer official-skeleton-row"></div>
      <div class="skeleton-shimmer official-skeleton-row"></div>
    </article>
  `).join("");
}

/* ==========================================================================
   Tournament Deduplication Engine
   "Only one name in a team & category only"
   ========================================================================== */
function processAndDeduplicateTeams(teamsByCategoryRaw = {}) {
  const allRawTeams = [];

  CATEGORIES.forEach((cat) => {
    const list = teamsByCategoryRaw[cat] || [];
    list.forEach((team) => {
      allRawTeams.push({
        ...team,
        category: cat,
        teamName: String(team.teamName || "Unnamed Team").trim(),
        playerOne: String(team.playerOne || "").trim(),
        playerOneId: String(team.playerOneId || "").trim(),
        playerTwo: String(team.playerTwo || "").trim(),
        playerTwoId: String(team.playerTwoId || "").trim()
      });
    });
  });

  // Sort chronologically by registration rowNumber or timestamp
  allRawTeams.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));

  const registeredPlayers = new Map(); // normalizedName -> { teamName, category, rowNumber }
  const registeredPlayerIds = new Map();
  const registeredTeamNamesByCat = new Map(); // category -> Set of normalized team names
  const officialTeams = {};
  const duplicateList = [];

  CATEGORIES.forEach((cat) => {
    officialTeams[cat] = [];
    registeredTeamNamesByCat.set(cat, new Set());
  });

  allRawTeams.forEach((team) => {
    const cat = team.category;
    const teamNameNorm = team.teamName.toLowerCase().replace(/\s+/g, " ");
    const p1Norm = normalizeName(team.playerOne);
    const p2Norm = normalizeName(team.playerTwo);
    const p1Id = team.playerOneId.toLowerCase().replace(/\s+/g, " ");
    const p2Id = team.playerTwoId.toLowerCase().replace(/\s+/g, " ");
    const catTeamSet = registeredTeamNamesByCat.get(cat);

    let conflictReason = null;

    // Rule 1: Within same team, Player 1 and Player 2 cannot be identical
    if (p1Norm && p1Norm === p2Norm) {
      conflictReason = `Player 1 and Player 2 cannot be the same person (${team.playerOne})`;
    }
    else if (p1Id && p1Id === p2Id) {
      conflictReason = "Player 1 and Player 2 cannot use the same ID No.";
    }
    // Rule 2: Player 1 cannot be already registered in another team or category
    else if (!duplicateEntryAllowed && p1Norm && registeredPlayers.has(p1Norm)) {
      const prev = registeredPlayers.get(p1Norm);
      conflictReason = `Player "${team.playerOne}" already registered in "${prev.teamName}" (${prev.category})`;
    }
    // Rule 3: Player 2 cannot be already registered in another team or category
    else if (!duplicateEntryAllowed && p2Norm && registeredPlayers.has(p2Norm)) {
      const prev = registeredPlayers.get(p2Norm);
      conflictReason = `Player "${team.playerTwo}" already registered in "${prev.teamName}" (${prev.category})`;
    }
    else if (!duplicateEntryAllowed && p1Id && registeredPlayerIds.has(p1Id)) {
      conflictReason = "Player 1 ID No. already registered in another team";
    }
    else if (!duplicateEntryAllowed && p2Id && registeredPlayerIds.has(p2Id)) {
      conflictReason = "Player 2 ID No. already registered in another team";
    }
    // Rule 4: Team name cannot be duplicate within the same category
    else if (teamNameNorm && catTeamSet.has(teamNameNorm)) {
      conflictReason = `Team name "${team.teamName}" already taken in ${cat}`;
    }

    if (conflictReason) {
      duplicateList.push({
        ...team,
        conflictReason
      });
    } else {
      if (!duplicateEntryAllowed && p1Norm) registeredPlayers.set(p1Norm, { teamName: team.teamName, category: cat, rowNumber: team.rowNumber });
      if (!duplicateEntryAllowed && p2Norm) registeredPlayers.set(p2Norm, { teamName: team.teamName, category: cat, rowNumber: team.rowNumber });
      if (!duplicateEntryAllowed && p1Id) registeredPlayerIds.set(p1Id, true);
      if (!duplicateEntryAllowed && p2Id) registeredPlayerIds.set(p2Id, true);
      if (teamNameNorm) catTeamSet.add(teamNameNorm);

      // Re-assign official sequential seed (#1, #2, #3...)
      officialTeams[cat].push({
        ...team,
        seed: officialTeams[cat].length + 1
      });
    }
  });

  allOfficialTeamsByCategory = officialTeams;
  removedDuplicates = duplicateList;

  // Calculate summary metrics
  let totalOfficial = 0;
  let activeCategoriesCount = 0;

  CATEGORIES.forEach((cat) => {
    const count = officialTeams[cat].length;
    totalOfficial += count;
    if (count > 0) activeCategoriesCount++;
  });

  if (totalTeams) totalTeams.textContent = `${totalOfficial} Teams`;
  if (officialActiveCategories) officialActiveCategories.textContent = `${activeCategoriesCount} of 7 Active`;
  if (duplicateRemovedCount) duplicateRemovedCount.textContent = `${removedDuplicates.length} Removed`;
  if (officialSlotsText) officialSlotsText.textContent = `${totalOfficial * 2} active players confirmed`;

  renderFilterChips();
  renderRemovedDuplicatesList();
  renderOfficialTeamsView();
}

/* ==========================================================================
   Category Filter Chips
   ========================================================================== */
function renderFilterChips() {
  if (!categoryFilterBar) return;

  let totalOfficial = 0;
  CATEGORIES.forEach(cat => {
    totalOfficial += (allOfficialTeamsByCategory[cat] || []).length;
  });

  const chips = [
    {
      id: "all",
      label: "All Categories",
      count: totalOfficial
    },
    ...CATEGORIES.map(cat => ({
      id: cat,
      label: getCategoryDivisionBadge(cat) === "Open Doubles" ? "Open Doubles" : cat.replace("Novice ", ""),
      count: (allOfficialTeamsByCategory[cat] || []).length
    }))
  ];

  categoryFilterBar.innerHTML = chips.map(chip => `
    <button type="button" class="filter-chip${activeCategoryFilter === chip.id ? " active" : ""}" data-filter="${escapeHtml(chip.id)}" role="tab" aria-selected="${activeCategoryFilter === chip.id}">
      <span>${escapeHtml(chip.label)}</span>
      <span class="chip-count">${chip.count}</span>
    </button>
  `).join("");

  categoryFilterBar.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategoryFilter = btn.dataset.filter;
      renderFilterChips();
      renderOfficialTeamsView();
    });
  });
}

/* ==========================================================================
   Render Removed Duplicates Audit Panel
   ========================================================================== */
function renderRemovedDuplicatesList() {
  if (!removedDuplicatesList) return;

  if (removedDuplicates.length === 0) {
    removedDuplicatesList.innerHTML = `
      <div class="removed-duplicate-item" style="grid-template-columns: 1fr; text-align: center; color: rgba(255,255,255,0.7);">
        ✓ No duplicate registrations detected. All registered teams adhere to tournament eligibility rules.
      </div>
    `;
    return;
  }

  removedDuplicatesList.innerHTML = removedDuplicates.map((team) => {
    const p1 = toProperCase(team.playerOne) || "Player 1 Pending";
    const p2 = toProperCase(team.playerTwo) || "Player 2 Pending";
    return `
      <div class="removed-duplicate-item">
        <div class="removed-item-head">
          <span class="removed-team-badge">${escapeHtml(getCategoryDivisionBadge(team.category))}</span>
          <span class="removed-status-tag">Duplicate Disqualified</span>
        </div>
        <div class="removed-team-info">
          <strong class="removed-team-name">${escapeHtml(team.teamName.toUpperCase())}</strong>
          <div class="removed-players-wrap">
            <span class="removed-player-chip">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
              <span>${escapeHtml(p1)}</span>
            </span>
            <span class="removed-player-chip">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
              <span>${escapeHtml(p2)}</span>
            </span>
          </div>
        </div>
        <div class="removed-reason-tag">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span>${escapeHtml(team.conflictReason)}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* ==========================================================================
   Render Official Teams Category Grid
   ========================================================================== */
function renderOfficialTeamsView() {
  if (!categoryGrid) return;

  const query = searchQuery.trim().toLowerCase();
  const categoriesToShow = activeCategoryFilter === "all"
    ? CATEGORIES
    : CATEGORIES.filter(cat => cat === activeCategoryFilter);

  const html = categoriesToShow.map((category) => {
    const allTeamsInCat = allOfficialTeamsByCategory[category] || [];
    
    // Apply search query filter if typed
    const filteredTeams = query
      ? allTeamsInCat.filter(t => {
          const tName = (t.teamName || "").toLowerCase();
          const p1 = (t.playerOne || "").toLowerCase();
          const p2 = (t.playerTwo || "").toLowerCase();
          return tName.includes(query) || p1.includes(query) || p2.includes(query);
        })
      : allTeamsInCat;

    const fillPercent = Math.min(100, Math.round((allTeamsInCat.length / MAX_TEAMS_PER_CATEGORY) * 100));

    let teamCardsHtml = "";
    if (filteredTeams.length > 0) {
      teamCardsHtml = filteredTeams.map((team) => {
        const p1 = toProperCase(team.playerOne) || "Player 1 Pending";
        const p2 = toProperCase(team.playerTwo) || "Player 2 Pending";
        return `
          <li class="official-team-row">
            <div class="team-header-row">
              <span class="official-team-seed">#${String(team.seed).padStart(2, "0")}</span>
              <strong class="official-team-title">${escapeHtml(team.teamName.toUpperCase())}</strong>
            </div>
            <div class="team-players-grid">
              <div class="player-pill">
                <svg class="player-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
                <span class="player-name">${escapeHtml(p1)}</span>
              </div>
              <div class="player-pill">
                <svg class="player-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
                <span class="player-name">${escapeHtml(p2)}</span>
              </div>
            </div>
          </li>
        `;
      }).join("");
    } else if (query && allTeamsInCat.length > 0) {
      teamCardsHtml = `
        <li class="official-empty-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>No teams match "${escapeHtml(searchQuery)}"</p>
          <small>Try searching another name</small>
        </li>
      `;
    } else {
      teamCardsHtml = `
        <li class="official-empty-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <p>No registered teams yet in this bracket.</p>
          <small>${registrationOpen ? "Open for registrations (16 slots available)" : "Registration closed"}</small>
        </li>
      `;
    }

    return `
      <article class="official-category-card">
        <header class="official-category-head">
          <div class="official-head-top">
            <span class="bracket-badge">${escapeHtml(getCategoryDivisionBadge(category))}</span>
            <span class="official-count-pill">${allTeamsInCat.length}/${MAX_TEAMS_PER_CATEGORY}</span>
          </div>
          <h2>${escapeHtml(getCategoryDisplayName(category))}</h2>
          <div class="category-capacity-meter" role="progressbar" aria-valuenow="${fillPercent}" aria-valuemin="0" aria-valuemax="100" title="${allTeamsInCat.length} of ${MAX_TEAMS_PER_CATEGORY} slots filled">
            <div class="category-capacity-fill" style="width: ${fillPercent}%;"></div>
          </div>
        </header>
        <ul class="official-team-list">${teamCardsHtml}</ul>
      </article>
    `;
  }).join("");

  categoryGrid.innerHTML = html;
}

/* ==========================================================================
   Data Fetching & Synchronization
   ========================================================================== */
async function loadOfficialTeams(isManualRefresh = false) {
  renderSkeleton();
  if (totalTeams) totalTeams.textContent = "Syncing...";
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.classList.add("is-loading");
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, { cache: "no-store" });
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || "Unable to load official teams.");
    
    registrationOpen = result.tournamentControls?.registrationOpen !== false;
    duplicateEntryAllowed = result.tournamentControls?.duplicateEntryAllowed === true;
    processAndDeduplicateTeams(result.teamsByCategory || {});
    if (isManualRefresh) showToast("success", "Official teams refreshed & deduplicated.");
  } catch (error) {
    processAndDeduplicateTeams({});
    showToast("error", "Unable to sync official teams right now.");
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.classList.remove("is-loading");
    }
  }
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */
if (refreshButton) {
  refreshButton.addEventListener("click", () => loadOfficialTeams(true));
}

if (rosterSearchInput) {
  rosterSearchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    if (clearSearchBtn) {
      clearSearchBtn.hidden = !searchQuery;
    }
    renderOfficialTeamsView();
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    rosterSearchInput.value = "";
    searchQuery = "";
    clearSearchBtn.hidden = true;
    rosterSearchInput.focus();
    renderOfficialTeamsView();
  });
}

if (auditToggleBtn) {
  auditToggleBtn.addEventListener("click", () => {
    isAuditOpen = !isAuditOpen;
    if (removedDuplicatesPanel) {
      removedDuplicatesPanel.hidden = !isAuditOpen;
      auditToggleBtn.setAttribute("aria-expanded", String(isAuditOpen));
      if (isAuditOpen) {
        removedDuplicatesPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  });
}

if (closeAuditBtn) {
  closeAuditBtn.addEventListener("click", () => {
    isAuditOpen = false;
    if (removedDuplicatesPanel) {
      removedDuplicatesPanel.hidden = true;
    }
    if (auditToggleBtn) {
      auditToggleBtn.setAttribute("aria-expanded", "false");
    }
  });
}

// Initial Load
loadOfficialTeams(false);
