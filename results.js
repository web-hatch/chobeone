/* ==========================================================================
   Cho-Be-One Mini Pickleball Tournament - Public Results Engine
   Identical visual styling and tree structure to bracketing.html
   ========================================================================== */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzi2CP7aG4bbH9fL5ZRqwtq-O10W9zK_COYd6VNhsjCtWbJxKpBQsuMlLlxME5Sdpbl/exec";

const CATEGORIES = [
  "Novice Low Men's Doubles",
  "Novice High Men's Doubles",
  "Novice Low Women's Doubles",
  "Novice High Women's Doubles",
  "Novice Low Mixed Doubles",
  "Novice High Mixed Doubles",
  "Open Doubles",
  "2nd Batch Open"
];

const MAX_TEAMS = 16;

// DOM Elements
const categorySelect = document.querySelector("#resultsCategorySelect");
const customDropdown = document.querySelector("#resultsCustomDropdown");
const dropdownTrigger = document.querySelector("#resultsDropdownTrigger");
const dropdownSelectedText = document.querySelector("#resultsDropdownSelectedText");
const dropdownMenu = document.querySelector("#resultsDropdownMenu");
const resultsStatusText = document.querySelector("#resultsStatusText");
const resultsCapacityFill = document.querySelector("#resultsCapacityFill");
const refreshButton = document.querySelector("#refreshResultsBtn");
const toastContainer = document.querySelector("#toastContainer");
const stageTabs = document.querySelectorAll(".stage-tab");

const classificationLayout = document.querySelector("#classificationLayout");
const resultsEmptyBanner = document.querySelector("#resultsEmptyBanner");
const eliminationSidebar = document.querySelector("#eliminationSidebar");
const stageInitial = document.querySelector("#stageInitial");
const initialMatchTable = document.querySelector("#initialMatchTable");
const stageBrackets = document.querySelector("#stageBrackets");
const stageHBracket = document.querySelector("#stageHBracket");
const stageLBracket = document.querySelector("#stageLBracket");
const stageRules = document.querySelector("#stageRules");
const hBracket = document.querySelector("#hBracket");
const lBracket = document.querySelector("#lBracket");

// State
let teamsByCategory = {};
let matchingTeamsByCategory = null;
let resultsByCategory = {};
let tournamentControls = null;
let isFetching = false;

/* ==========================================================================
   Utilities
   ========================================================================== */
function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
}

function toProperCase(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
}

function getCategoryDisplayName(category) {
  if (category === "Open Doubles") {
    return "Open Doubles (Intermediate & Advance)";
  }
  return category;
}

function getCurrentCategory() {
  return categorySelect ? categorySelect.value : CATEGORIES[0];
}

function isSameTeam(teamA, teamB) {
  if (!teamA || !teamB) return false;
  if (teamA.id && teamB.id) return teamA.id === teamB.id;
  return Number(teamA.seed) === Number(teamB.seed);
}

/* ==========================================================================
   Global Centralized Floating Toast Notifications
   ========================================================================== */
function showToast(type, message, duration = 4500) {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;
  toast.setAttribute("role", "alert");

  const iconSvg = type === "success"
    ? `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`
    : `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-body">
      <span class="toast-message">${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 250);
  });

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));

  setTimeout(() => {
    if (toast.isConnected) {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

/* ==========================================================================
   Skeleton Loading State (Rule: Always implement skeleton loading)
   ========================================================================== */
function renderSkeletonState() {
  if (initialMatchTable) {
    initialMatchTable.innerHTML = Array.from({ length: 8 }, () => `
      <div class="skeleton-match-card">
        <div class="skeleton-shimmer skeleton-box" style="width: 36px; border-radius: 6px;"></div>
        <div class="skeleton-shimmer skeleton-box" style="border-radius: 6px;"></div>
        <div style="text-align: center; color: rgba(255,255,255,0.2); font-weight: 800; font-size: 0.65rem;">VS</div>
        <div class="skeleton-shimmer skeleton-box" style="border-radius: 6px;"></div>
      </div>
    `).join("");
  }

  const createTreeSkeleton = () => `
    <!-- Column 1: Quarterfinals Skeleton -->
    <div class="bracket-round qf-round">
      <div class="round-header"><span class="round-pill">Quarterfinals (4)</span></div>
      <div class="round-matches">
        ${Array.from({ length: 4 }, () => `
          <div class="skeleton-node">
            <div class="skeleton-shimmer skeleton-line"></div>
            <div class="skeleton-shimmer skeleton-line-sm"></div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Connector 1: QF -> SF -->
    <div class="bracket-connector-col" aria-hidden="true">
      <div class="connector-header-spacer"></div>
      <div class="connector-body">
        <div class="connector-cell">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 25 H 18 V 75 H 0 M 18 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
        <div class="connector-cell">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 25 H 18 V 75 H 0 M 18 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Column 2: Semifinals Skeleton -->
    <div class="bracket-round sf-round">
      <div class="round-header"><span class="round-pill">Semifinals (2)</span></div>
      <div class="round-matches">
        ${Array.from({ length: 2 }, () => `
          <div class="skeleton-node">
            <div class="skeleton-shimmer skeleton-line"></div>
            <div class="skeleton-shimmer skeleton-line-sm"></div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Connector 2: SF -> Finals -->
    <div class="bracket-connector-col" aria-hidden="true">
      <div class="connector-header-spacer"></div>
      <div class="connector-body">
        <div class="connector-cell full-height">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 25 H 18 V 75 H 0 M 18 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Column 3: Championship Final Skeleton -->
    <div class="bracket-round finals-round">
      <div class="round-header"><span class="round-pill">Championship Final</span></div>
      <div class="round-matches">
        <div class="skeleton-node" style="min-height: 90px;">
          <div class="skeleton-shimmer skeleton-line"></div>
          <div class="skeleton-shimmer skeleton-line-sm"></div>
        </div>
      </div>
    </div>

    <!-- Connector 3: Finals -> Podium -->
    <div class="bracket-connector-col" aria-hidden="true">
      <div class="connector-header-spacer"></div>
      <div class="connector-body">
        <div class="connector-cell full-height">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Column 4: Champion Podium Skeleton -->
    <div class="bracket-round podium-round">
      <div class="round-header"><span class="round-pill">Champion</span></div>
      <div class="round-matches">
        <div class="champion-podium skeleton-shimmer" style="opacity: 0.6; width: 100%;">
          <div class="trophy-badge">🏆</div>
          <div class="champion-tier-title">Championship</div>
        </div>
      </div>
    </div>
  `;

  if (hBracket) hBracket.innerHTML = createTreeSkeleton();
  if (lBracket) lBracket.innerHTML = createTreeSkeleton();
}

/* ==========================================================================
   Seeding and Team Helpers
   ========================================================================== */
function normalizeTeam(team, index) {
  const teamName = String(team.teamName || `Team ${index + 1}`).trim();
  return {
    seed: team.seed || index + 1,
    id: `seed-${team.seed || index + 1}-${teamName.toUpperCase()}`,
    teamName: teamName.toUpperCase(),
    playerOne: toProperCase(team.playerOne || ""),
    playerTwo: toProperCase(team.playerTwo || "")
  };
}

function createByeTeam(seed) {
  return {
    seed,
    id: `bye-${seed}`,
    teamName: "BYE",
    playerOne: "Automatic advance",
    playerTwo: "",
    isBye: true
  };
}

function getMatchingTeams(category) {
  const matching = matchingTeamsByCategory && matchingTeamsByCategory[category];
  if (Array.isArray(matching) && matching.length) return matching;
  return teamsByCategory[category] || [];
}

function seedTeamsForMatches(teams) {
  const normalizedTeams = teams.slice(0, MAX_TEAMS).map((team, index) => normalizeTeam(team, index));

  return Array.from({ length: 8 }, (_, index) => ({
    match: index + 1,
    teamA: normalizedTeams[index * 2] || createByeTeam(index * 2 + 1),
    teamB: normalizedTeams[index * 2 + 1] || createByeTeam(index * 2 + 2)
  }));
}

function getCategoryResults(category) {
  const categoryResults = resultsByCategory[category];
  return {
    initial: (categoryResults && categoryResults.initial) || {},
    H: (categoryResults && categoryResults.H) || {},
    L: (categoryResults && categoryResults.L) || {}
  };
}

function pickWinner(match, storedWinnerId) {
  if (!match || !match.teamA || !match.teamB) return null;
  if (match.teamA.isBye && !match.teamB.isBye) return match.teamB;
  if (match.teamB.isBye && !match.teamA.isBye) return match.teamA;
  if (!storedWinnerId) return null;

  if (isSameTeam(match.teamA, { id: storedWinnerId })) return match.teamA;
  if (isSameTeam(match.teamB, { id: storedWinnerId })) return match.teamB;
  return null;
}

function getMatchLoser(match, winner) {
  if (!match || !winner) return null;
  if (isSameTeam(match.teamA, winner)) return match.teamB;
  if (isSameTeam(match.teamB, winner)) return match.teamA;
  return null;
}

/* ==========================================================================
   Render Initial Round (Stage 1)
   ========================================================================== */
function renderTeamSlot(team, prefixTag, selectedTeam = null, resultBadge = "") {
  if (!team) {
    return `
      <div class="match-team-slot" style="background: rgba(255, 255, 255, 0.9);">
        <div class="team-slot-top">
          <span class="team-seed-pill" style="opacity: 0.6;">${prefixTag}</span>
          <span class="team-name" style="color: #64746a; font-style: italic;">Open Slot</span>
        </div>
        <div class="team-players" style="color: #8c9b91;">Waiting for registration</div>
      </div>
    `;
  }

  const players = (team.playerOne && team.playerTwo)
    ? `${escapeHtml(team.playerOne)} &amp; ${escapeHtml(team.playerTwo)}`
    : (escapeHtml(team.playerOne || team.playerTwo) || (team.isBye ? "Automatic advance" : "Tournament Contender"));

  const selectedClass = selectedTeam && isSameTeam(team, selectedTeam) ? " is-winner" : "";
  const loserClass = resultBadge === "L" ? " is-loser" : "";
  const byeClass = team.isBye ? " is-bye" : "";
  const badgeMarkup = resultBadge ? `<span class="result-badge result-badge-${resultBadge.toLowerCase()}">${resultBadge}</span>` : "";

  return `
    <div class="match-team-slot${selectedClass}${loserClass}${byeClass}">
      <div class="team-slot-top">
        <span class="team-seed-pill">${team.isBye ? "BYE" : `#${team.seed}`}</span>
        <span class="team-name" title="${escapeHtml(team.teamName)}">${escapeHtml(team.teamName)}</span>
        ${badgeMarkup}
      </div>
      <div class="team-players" title="${players}">${players}</div>
    </div>
  `;
}

function renderInitialMatches(teams) {
  if (!initialMatchTable) return;
  const matches = seedTeamsForMatches(teams);
  const results = getCategoryResults(getCurrentCategory());

  initialMatchTable.innerHTML = matches.map((match) => {
    const winner = pickWinner(match, results.initial[match.match]);
    const loser = getMatchLoser(match, winner);

    return `
    <div class="match-card result-match-card is-public-view" data-stage="initial" data-match="${match.match}">
      <div class="match-index-badge">
        <span>M</span>
        0${match.match}
      </div>
      ${renderTeamSlot(match.teamA, `A${match.match}`, winner, isSameTeam(match.teamA, winner) ? "W" : (isSameTeam(match.teamA, loser) ? "L" : ""))}
      <div class="match-vs-divider">VS</div>
      ${renderTeamSlot(match.teamB, `B${match.match}`, winner, isSameTeam(match.teamB, winner) ? "W" : (isSameTeam(match.teamB, loser) ? "L" : ""))}
    </div>
    `;
  }).join("");
}

/* ==========================================================================
   Render Connected Tournament Trees (Stage 2 & Stage 3)
   ========================================================================== */
function buildInitialRoutes(teams, results) {
  const hSeeds = Array(8).fill(null);
  const lSeeds = Array(8).fill(null);

  seedTeamsForMatches(teams).forEach((match) => {
    const winner = pickWinner(match, results.initial[match.match]);
    const loser = getMatchLoser(match, winner);

    const unused = match.teamA?.isBye && match.teamB?.isBye;
    hSeeds[match.match - 1] = winner || (unused ? createByeTeam(`H-${match.match}`) : null);
    lSeeds[match.match - 1] = loser || (match.teamA?.isBye || match.teamB?.isBye ? createByeTeam(`L-${match.match}`) : null);
  });

  return { H: hSeeds, L: lSeeds };
}

function getAdvancingTeam(match, storedWinnerId, prefix) {
  return pickWinner(match, storedWinnerId)
    || (match.teamA?.isBye && match.teamB?.isBye ? createByeTeam(`${prefix}-${match.id}`) : null);
}

function buildDivisionMatches(seeds, results, prefix) {
  const qf = Array.from({ length: 4 }, (_, index) => ({
    id: `QF-${index + 1}`,
    code: `Match QF-${index + 1}`,
    status: "Set of 1",
    teamA: seeds[index * 2],
    teamB: seeds[index * 2 + 1]
  }));
  const qfWinners = qf.map((match) => getAdvancingTeam(match, results[prefix][match.id], prefix));
  const sf = Array.from({ length: 2 }, (_, index) => ({
    id: `SF-${index + 1}`,
    code: `Semifinal ${index + 1}`,
    status: "Knockout",
    teamA: qfWinners[index * 2],
    teamB: qfWinners[index * 2 + 1]
  }));
  const sfWinners = sf.map((match) => getAdvancingTeam(match, results[prefix][match.id], prefix));
  const final = {
    id: "FINAL",
    code: "Gold Medal Match",
    status: "Championship",
    teamA: sfWinners[0],
    teamB: sfWinners[1]
  };

  return {
    qf,
    sf,
    final,
    champion: pickWinner(final, results[prefix][final.id])
  };
}

function renderTreeSlot(team, fallbackTag, fallbackLabel, selectedTeam = null, resultBadge = "") {
  const isWinner = selectedTeam && isSameTeam(team, selectedTeam);
  const isLoser = resultBadge === "L";
  const slotClass = `tree-team-slot${team ? "" : " is-empty"}${isWinner ? " is-winner" : ""}${isLoser ? " is-loser" : ""}`;
  const label = team ? team.teamName : fallbackLabel;
  const tag = team ? (team.isBye ? "BYE" : `#${team.seed}`) : fallbackTag;
  const badgeMarkup = resultBadge ? `<span class="result-badge result-badge-${resultBadge.toLowerCase()}">${resultBadge}</span>` : "";

  return `
    <div class="${slotClass}">
      <div class="slot-identity">
        <span class="slot-tag">${escapeHtml(tag)}</span>
        <span class="slot-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      </div>
      ${badgeMarkup}
    </div>
  `;
}

function renderDivisionMatch(match, prefix, fallbackA, fallbackB, selectedTeam = null) {
  const winner = selectedTeam;
  const loser = getMatchLoser(match, winner);
  const badgeA = isSameTeam(match.teamA, winner) ? "W" : (isSameTeam(match.teamA, loser) ? "L" : "");
  const badgeB = isSameTeam(match.teamB, winner) ? "W" : (isSameTeam(match.teamB, loser) ? "L" : "");

  return `
    <div class="tree-match-node result-match-card is-public-view" data-stage="division" data-prefix="${prefix}" data-match="${escapeHtml(match.id)}">
      <div class="tree-match-head">
        <span class="match-code">${escapeHtml(match.code)}</span>
        <span class="slot-status-pill">${escapeHtml(match.status)}</span>
      </div>
      ${renderTreeSlot(match.teamA, fallbackA.tag, fallbackA.label, winner, badgeA)}
      ${renderTreeSlot(match.teamB, fallbackB.tag, fallbackB.label, winner, badgeB)}
    </div>
  `;
}

function renderBracket(container, prefix) {
  if (!container) return;
  const divisionTitle = prefix === "H" ? "Championship H" : "Consolation L";
  const teams = getMatchingTeams(getCurrentCategory());
  const results = getCategoryResults(getCurrentCategory());
  const divisionSeeds = buildInitialRoutes(teams, results)[prefix];
  const divisionMatches = buildDivisionMatches(divisionSeeds, results, prefix);

  // Quarterfinals (4 matches)
  const qfNodes = divisionMatches.qf.map((match, i) => {
    const seed1 = i * 2 + 1;
    const seed2 = i * 2 + 2;
    return renderDivisionMatch(
      match,
      prefix,
      { tag: `${prefix}${seed1}`, label: `${prefix} Seed ${seed1}` },
      { tag: `${prefix}${seed2}`, label: `${prefix} Seed ${seed2}` },
      pickWinner(match, results[prefix][match.id])
    );
  }).join("");

  // Semifinals (2 matches)
  const sfNodes = divisionMatches.sf.map((match, i) => renderDivisionMatch(
    match,
    prefix,
    { tag: "SF", label: `Winner QF-${i * 2 + 1}` },
    { tag: "SF", label: `Winner QF-${i * 2 + 2}` },
    pickWinner(match, results[prefix][match.id])
  )).join("");

  // Championship Final (1 match)
  const finalsNode = renderDivisionMatch(
    divisionMatches.final,
    prefix,
    { tag: "F1", label: "Winner Semifinal 1" },
    { tag: "F2", label: "Winner Semifinal 2" },
    pickWinner(divisionMatches.final, results[prefix][divisionMatches.final.id])
  );

  // Champion Showcase Podium
  const championPodium = `
    <div class="champion-podium${divisionMatches.champion ? " has-champion" : ""}">
      <div class="trophy-badge" aria-hidden="true">${prefix === "H" ? "🏆" : "🏅"}</div>
      <div class="champion-tier-title">${divisionTitle} Champion</div>
      <div class="champion-sub-text">${divisionMatches.champion ? escapeHtml(divisionMatches.champion.teamName) : (prefix === "H" ? "Grand Champion Award" : "Consolation Trophy")}</div>
    </div>
  `;

  container.innerHTML = `
    <!-- Column 1: Quarterfinals -->
    <div class="bracket-round qf-round">
      <div class="round-header"><span class="round-pill">Quarterfinals (4)</span></div>
      <div class="round-matches">${qfNodes}</div>
    </div>

    <!-- Connector 1: QF -> SF -->
    <div class="bracket-connector-col" aria-hidden="true">
      <div class="connector-header-spacer"></div>
      <div class="connector-body">
        <div class="connector-cell">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 25 H 18 V 75 H 0 M 18 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
        <div class="connector-cell">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 25 H 18 V 75 H 0 M 18 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Column 2: Semifinals -->
    <div class="bracket-round sf-round">
      <div class="round-header"><span class="round-pill">Semifinals (2)</span></div>
      <div class="round-matches">${sfNodes}</div>
    </div>

    <!-- Connector 2: SF -> Finals -->
    <div class="bracket-connector-col" aria-hidden="true">
      <div class="connector-header-spacer"></div>
      <div class="connector-body">
        <div class="connector-cell full-height">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 25 H 18 V 75 H 0 M 18 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Column 3: Championship Final -->
    <div class="bracket-round finals-round">
      <div class="round-header"><span class="round-pill">Championship Final</span></div>
      <div class="round-matches">${finalsNode}</div>
    </div>

    <!-- Connector 3: Finals -> Podium -->
    <div class="bracket-connector-col" aria-hidden="true">
      <div class="connector-header-spacer"></div>
      <div class="connector-body">
        <div class="connector-cell full-height">
          <svg viewBox="0 0 36 100" preserveAspectRatio="none" class="bracket-svg">
            <path d="M 0 50 H 36" stroke="var(--gold-400)" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Column 4: Champion Podium -->
    <div class="bracket-round podium-round">
      <div class="round-header"><span class="round-pill">Champion</span></div>
      <div class="round-matches">${championPodium}</div>
    </div>
  `;
}

/* ==========================================================================
   Category Rendering & Status Tracking
   ========================================================================== */
function renderCategory(categoryName) {
  const teams = getMatchingTeams(categoryName);
  const results = getCategoryResults(categoryName);

  // Count recorded matches
  const initialMatches = seedTeamsForMatches(teams);
  let recordedCount = 0;
  initialMatches.forEach((m) => {
    if (pickWinner(m, results.initial[m.match])) recordedCount++;
  });
  const divisionHMatches = buildDivisionMatches(buildInitialRoutes(teams, results).H, results, "H");
  const divisionLMatches = buildDivisionMatches(buildInitialRoutes(teams, results).L, results, "L");

  [...divisionHMatches.qf, ...divisionHMatches.sf, divisionHMatches.final].forEach((m) => {
    if (pickWinner(m, results.H[m.id])) recordedCount++;
  });
  [...divisionLMatches.qf, ...divisionLMatches.sf, divisionLMatches.final].forEach((m) => {
    if (pickWinner(m, results.L[m.id])) recordedCount++;
  });

  const totalPossibleMatches = 22; // 8 initial + 7 H + 7 L
  const progressPercent = Math.min(100, Math.round((recordedCount / totalPossibleMatches) * 100));

  if (resultsStatusText) {
    if (!teams.length) {
      resultsStatusText.textContent = "Waiting for published draw";
    } else {
      resultsStatusText.textContent = `${recordedCount} / ${totalPossibleMatches} Matches Completed (${teams.length} Teams)`;
    }
  }

  if (resultsCapacityFill) {
    resultsCapacityFill.style.width = `${progressPercent}%`;
  }

  renderInitialMatches(teams);
  renderBracket(hBracket, "H");
  renderBracket(lBracket, "L");
}

/* ==========================================================================
   Custom Dropdown Component (UX & Full Inertial Capabilities)
   ========================================================================== */
function openCustomDropdown() {
  if (!customDropdown) return;
  customDropdown.classList.add("open");
  customDropdown.setAttribute("aria-expanded", "true");
}

function closeCustomDropdown() {
  if (!customDropdown) return;
  customDropdown.classList.remove("open");
  customDropdown.setAttribute("aria-expanded", "false");
}

function toggleCustomDropdown() {
  if (!customDropdown) return;
  if (customDropdown.classList.contains("open")) {
    closeCustomDropdown();
  } else {
    openCustomDropdown();
  }
}

function renderCustomDropdownOptions() {
  if (!dropdownMenu) return;
  dropdownMenu.innerHTML = "";

  CATEGORIES.forEach((category) => {
    const teams = getMatchingTeams(category);
    const isSelected = categorySelect ? categorySelect.value === category : false;

    const li = document.createElement("li");
    li.className = `dropdown-option${isSelected ? " selected" : ""}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", isSelected ? "true" : "false");
    li.dataset.value = category;

    li.innerHTML = `
      <span class="option-name">${escapeHtml(getCategoryDisplayName(category))}</span>
      <span class="option-badge">${teams.length}/${MAX_TEAMS} Teams</span>
    `;

    li.addEventListener("click", (e) => {
      e.stopPropagation();
      selectCategory(category);
      closeCustomDropdown();
    });

    dropdownMenu.appendChild(li);
  });

  if (dropdownSelectedText && categorySelect && categorySelect.value) {
    dropdownSelectedText.textContent = getCategoryDisplayName(categorySelect.value);
  }
}

function selectCategory(categoryName) {
  if (categorySelect && categorySelect.value !== categoryName) {
    categorySelect.value = categoryName;
  }

  if (dropdownSelectedText) {
    dropdownSelectedText.textContent = getCategoryDisplayName(categoryName);
  }

  if (dropdownMenu) {
    Array.from(dropdownMenu.children).forEach((child) => {
      const matches = child.dataset.value === categoryName;
      child.classList.toggle("selected", matches);
      child.setAttribute("aria-selected", matches ? "true" : "false");
    });
  }

  renderCategory(categoryName);
}

function populateCategorySelect() {
  if (!categorySelect) return;
  categorySelect.innerHTML = CATEGORIES.map((category) => `
    <option value="${escapeHtml(category)}">${escapeHtml(getCategoryDisplayName(category))}</option>
  `).join("");
  categorySelect.value = CATEGORIES[0];
  if (dropdownSelectedText) {
    dropdownSelectedText.textContent = getCategoryDisplayName(CATEGORIES[0]);
  }
  renderCustomDropdownOptions();
}

/* ==========================================================================
   Stage Navigation Tabs (Responsive & Touch Accessibility)
   ========================================================================== */
stageTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    stageTabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    const stage = tab.getAttribute("data-stage");

    if (window.innerWidth <= 1260) {
      if (stage === "all") {
        if (eliminationSidebar) eliminationSidebar.style.display = "";
        if (stageInitial) stageInitial.style.display = "";
        if (stageBrackets) stageBrackets.style.display = "";
        if (stageHBracket) stageHBracket.style.display = "";
        if (stageLBracket) stageLBracket.style.display = "";
        if (stageRules) stageRules.style.display = "";
      } else if (stage === "initial") {
        if (eliminationSidebar) eliminationSidebar.style.display = "";
        if (stageInitial) stageInitial.style.display = "";
        if (stageBrackets) stageBrackets.style.display = "none";
        if (stageRules) stageRules.style.display = "none";
        if (stageInitial) stageInitial.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (stage === "h-bracket") {
        if (eliminationSidebar) eliminationSidebar.style.display = "none";
        if (stageInitial) stageInitial.style.display = "none";
        if (stageBrackets) stageBrackets.style.display = "";
        if (stageHBracket) stageHBracket.style.display = "";
        if (stageLBracket) stageLBracket.style.display = "none";
        if (stageRules) stageRules.style.display = "none";
        if (stageHBracket) stageHBracket.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (stage === "l-bracket") {
        if (eliminationSidebar) eliminationSidebar.style.display = "none";
        if (stageInitial) stageInitial.style.display = "none";
        if (stageBrackets) stageBrackets.style.display = "";
        if (stageHBracket) stageHBracket.style.display = "none";
        if (stageLBracket) stageLBracket.style.display = "";
        if (stageRules) stageRules.style.display = "none";
        if (stageLBracket) stageLBracket.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (stage === "rules") {
        if (eliminationSidebar) eliminationSidebar.style.display = "";
        if (stageInitial) stageInitial.style.display = "none";
        if (stageBrackets) stageBrackets.style.display = "none";
        if (stageRules) stageRules.style.display = "";
        if (stageRules) stageRules.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      if (stage === "initial" && stageInitial) {
        stageInitial.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (stage === "h-bracket" && stageHBracket) {
        stageHBracket.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (stage === "l-bracket" && stageLBracket) {
        stageLBracket.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (stage === "rules" && stageRules) {
        stageRules.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
});

/* ==========================================================================
   Data Synchronization & Fetching
   ========================================================================== */
async function loadResults(isManual = false) {
  if (isFetching) return;
  isFetching = true;

  if (refreshButton) {
    refreshButton.classList.add("is-loading");
    refreshButton.disabled = true;
  }

  // Display skeleton loading while fetching
  renderSkeletonState();

  try {
    const url = new URL(GOOGLE_SCRIPT_URL);
    // Fetch full tournament payload
    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message || "Unable to sync tournament data.");
    }

    tournamentControls = result.tournamentControls || null;
    matchingTeamsByCategory = result.matchingTeamsByCategory || null;
    teamsByCategory = result.teamsByCategory || {};
    resultsByCategory = (result.bracketState && result.bracketState.results) || {};

    const isMatchingLocked = tournamentControls ? tournamentControls.matchingLocked === true : true;

    if (!isMatchingLocked && (!matchingTeamsByCategory || Object.keys(matchingTeamsByCategory).length === 0)) {
      if (resultsEmptyBanner) {
        resultsEmptyBanner.hidden = false;
        resultsEmptyBanner.innerHTML = `
          <div class="results-empty-icon" aria-hidden="true">⏳</div>
          <h3 class="results-empty-title">Tournament Draw Not Locked Yet</h3>
          <p class="results-empty-desc">The official tournament draw and pairings will appear here once finalized and locked by event organizers.</p>
        `;
      }
      if (classificationLayout) {
        classificationLayout.style.opacity = "0.75";
      }
    } else {
      if (resultsEmptyBanner) resultsEmptyBanner.hidden = true;
      if (classificationLayout) {
        classificationLayout.style.opacity = "1";
        classificationLayout.style.display = "";
      }
    }

    renderCustomDropdownOptions();
    renderCategory(getCurrentCategory());

    if (isManual) {
      showToast("success", "Tournament results updated successfully.");
    }
  } catch (error) {
    console.error("Results fetch error:", error);
    showToast("error", error.message || "Unable to sync latest results. Check your connection.");
    // Fallback render with existing state
    renderCategory(getCurrentCategory());
  } finally {
    isFetching = false;
    if (refreshButton) {
      refreshButton.classList.remove("is-loading");
      refreshButton.disabled = false;
    }
  }
}

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */
if (dropdownTrigger) {
  dropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCustomDropdown();
  });
}

document.addEventListener("click", (e) => {
  if (customDropdown && !customDropdown.contains(e.target)) {
    closeCustomDropdown();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && customDropdown?.classList.contains("open")) {
    closeCustomDropdown();
  }
});

if (refreshButton) {
  refreshButton.addEventListener("click", () => loadResults(true));
}

// Window resize listener for responsive stage view resets
window.addEventListener("resize", () => {
  if (window.innerWidth > 1260) {
    if (eliminationSidebar) eliminationSidebar.style.display = "";
    if (stageInitial) stageInitial.style.display = "";
    if (stageBrackets) stageBrackets.style.display = "";
    if (stageHBracket) stageHBracket.style.display = "";
    if (stageLBracket) stageLBracket.style.display = "";
    if (stageRules) stageRules.style.display = "";
  }
});

// Setup dropdown and initial data load
populateCategorySelect();
loadResults(false);
