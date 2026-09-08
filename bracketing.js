const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzi2CP7aG4bbH9fL5ZRqwtq-O10W9zK_COYd6VNhsjCtWbJxKpBQsuMlLlxME5Sdpbl/exec";
const MAX_TEAMS = 16;
const ADMIN_PASSWORD = "Slasher15";
const CATEGORIES = [
  "Novice Low Men's Doubles",
  "Novice High Men's Doubles",
  "Novice Low Women's Doubles",
  "Novice High Women's Doubles",
  "Novice Low Mixed Doubles",
  "Novice High Mixed Doubles",
  "Open Doubles"
];

// DOM Elements
const categorySelect = document.querySelector("#bracketCategorySelect");
const customDropdown = document.querySelector("#bracketCustomDropdown");
const dropdownTrigger = document.querySelector("#bracketDropdownTrigger");
const dropdownSelectedText = document.querySelector("#bracketDropdownSelectedText");
const dropdownMenu = document.querySelector("#bracketDropdownMenu");
const bracketCount = document.querySelector("#bracketCount");
const capacityFill = document.querySelector("#capacityFill");
const initialMatchTable = document.querySelector("#initialMatchTable");
const hBracket = document.querySelector("#hBracket");
const lBracket = document.querySelector("#lBracket");
const refreshButton = document.querySelector("#refreshBracketBtn");
const toastContainer = document.querySelector("#toastContainer");
const stageTabs = document.querySelectorAll(".stage-tab");
const eliminationSidebar = document.querySelector("#eliminationSidebar");
const stageInitial = document.querySelector("#stageInitial");
const stageBrackets = document.querySelector("#stageBrackets");
const stageHBracket = document.querySelector("#stageHBracket");
const stageLBracket = document.querySelector("#stageLBracket");
const stageRules = document.querySelector("#stageRules");
const resultModalBackdrop = document.querySelector("#resultModalBackdrop");
const resultModalClose = document.querySelector("#resultModalClose");
const resultModalCancel = document.querySelector("#resultModalCancel");
const resultModalCategory = document.querySelector("#resultModalCategory");
const resultModalTitle = document.querySelector("#resultModalTitle");
const resultModalDesc = document.querySelector("#resultModalDesc");
const resultWinnerOptions = document.querySelector("#resultWinnerOptions");
const adminAccessBtn = document.querySelector("#adminAccessBtn");
const adminAccessText = document.querySelector("#adminAccessText");
const adminModalBackdrop = document.querySelector("#adminModalBackdrop");
const adminModalClose = document.querySelector("#adminModalClose");
const adminModalCancel = document.querySelector("#adminModalCancel");
const adminAccessForm = document.querySelector("#adminAccessForm");
const adminPasswordInput = document.querySelector("#adminPasswordInput");
const adminErrorText = document.querySelector("#adminErrorText");
const bracketAccessModalBackdrop = document.querySelector("#bracketAccessModalBackdrop");
const bracketAccessForm = document.querySelector("#bracketAccessForm");
const bracketAccessPasswordInput = document.querySelector("#bracketAccessPasswordInput");
const bracketAccessErrorText = document.querySelector("#bracketAccessErrorText");
const bracketAccessCancel = document.querySelector("#bracketAccessCancel");

let teamsByCategory = {};
let isFetching = false;
let bracketResultsByCategory = loadBracketResults();
let pendingWinnerResolver = null;
let pendingAdminResolver = null;
let resultDialogTeams = [];
let isAdminUnlocked = sessionStorage.getItem("chobeoneBracketAdminUnlocked") === "true";
let isBracketAccessUnlocked = sessionStorage.getItem("chobeoneBracketAccessUnlocked") === "true";

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

  // Trigger smooth inertial entrance
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

  const closeBtn = toast.querySelector(".toast-close");
  if (closeBtn) closeBtn.addEventListener("click", dismissToast);
  setTimeout(dismissToast, duration);
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */
function getCategoryDisplayName(categoryName) {
  return categoryName === "Open Doubles"
    ? "Open Doubles (Intermediate & Advance)"
    : categoryName;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function toProperCase(str) {
  if (!str || typeof str !== "string") return "";

  let isFirst = true;
  return str.replace(/([^\s\-\u2010-\u2015\/&]+)/g, (word) => {
    const upper = word.toUpperCase();
    const firstWord = isFirst;
    isFirst = false;

    // Preserve known uppercase acronyms like CPC or short all-consonant codes
    if (upper === "CPC" || (word.length <= 3 && word === upper && !/[aeiouy]/i.test(word))) {
      return upper;
    }

    // Roman numerals (II, III, IV, etc.)
    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i.test(word)) {
      return upper;
    }

    // Single initials with or without dot (e.g. "K.", "L", "F.")
    if (/^[A-Za-z]\.?$/.test(word)) {
      return upper;
    }

    // Lowercase connectors if not first word
    if (!firstWord && /^(and|de|del|van|von|der)$/i.test(word)) {
      return word.toLowerCase();
    }

    // Proper case: First uppercase, rest lowercase
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function normalizeTeam(team, index) {
  return {
    seed: team.seed || index + 1,
    id: `seed-${team.seed || index + 1}-${String(team.teamName || `Team ${index + 1}`).toUpperCase()}`,
    teamName: (team.teamName || `Team ${index + 1}`).toUpperCase(),
    playerOne: toProperCase(team.playerOne || ""),
    playerTwo: toProperCase(team.playerTwo || "")
  };
}

function seedTeamsForMatches(teams) {
  const normalizedTeams = teams.slice(0, MAX_TEAMS).map((team, index) => normalizeTeam(team, index));
  const pairCount = Math.ceil(normalizedTeams.length / 2);

  return Array.from({ length: 8 }, (_, index) => ({
    match: index + 1,
    teamA: index < pairCount ? normalizedTeams[index * 2] : null,
    teamB: index < pairCount ? (normalizedTeams[index * 2 + 1] || createByeTeam(index * 2 + 2)) : null
  }));
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

function loadBracketResults() {
  try {
    return JSON.parse(localStorage.getItem("chobeoneBracketResultsV1")) || {};
  } catch (error) {
    return {};
  }
}

function saveBracketResults() {
  localStorage.setItem("chobeoneBracketResultsV1", JSON.stringify(bracketResultsByCategory));
}

function getCategoryResults(categoryName) {
  if (!bracketResultsByCategory[categoryName]) {
    bracketResultsByCategory[categoryName] = { initial: {}, H: {}, L: {} };
  }
  bracketResultsByCategory[categoryName].initial = bracketResultsByCategory[categoryName].initial || {};
  bracketResultsByCategory[categoryName].H = bracketResultsByCategory[categoryName].H || {};
  bracketResultsByCategory[categoryName].L = bracketResultsByCategory[categoryName].L || {};
  return bracketResultsByCategory[categoryName];
}

function getCurrentCategory() {
  return categorySelect && categorySelect.value ? categorySelect.value : CATEGORIES[0];
}

function hasPlayableTeams(match) {
  return match.teamA && match.teamB && !match.teamA.isBye && !match.teamB.isBye;
}

function getAutoWinner(match) {
  if (match.teamA && match.teamB && match.teamA.isBye && !match.teamB.isBye) return match.teamB;
  if (match.teamA && match.teamB && match.teamB.isBye && !match.teamA.isBye) return match.teamA;
  return null;
}

function isSameTeam(a, b) {
  return Boolean(a && b && a.id === b.id);
}

function pickWinner(match, storedWinnerId) {
  const autoWinner = getAutoWinner(match);
  if (autoWinner) return autoWinner;
  if (!storedWinnerId) return null;
  return [match.teamA, match.teamB].find((team) => team && team.id === storedWinnerId) || null;
}

function getMatchLoser(match, winner) {
  if (!winner || !match.teamA || !match.teamB || match.teamA.isBye || match.teamB.isBye) return null;
  return isSameTeam(match.teamA, winner) ? match.teamB : match.teamA;
}

function updateAdminAccessUi() {
  if (!adminAccessBtn || !adminAccessText) return;
  adminAccessText.textContent = isAdminUnlocked ? "Admin Active" : "Admin";
  adminAccessBtn.classList.toggle("is-admin-active", isAdminUnlocked);
}

function unlockAdminWithPassword(password) {
  if (password !== ADMIN_PASSWORD) return false;
  isAdminUnlocked = true;
  sessionStorage.setItem("chobeoneBracketAdminUnlocked", "true");
  updateAdminAccessUi();
  return true;
}

function updateBracketAccessUi() {
  document.body.classList.toggle("bracket-access-locked", !isBracketAccessUnlocked);
  if (!bracketAccessModalBackdrop) return;
  bracketAccessModalBackdrop.classList.toggle("open", !isBracketAccessUnlocked);
  bracketAccessModalBackdrop.setAttribute("aria-hidden", isBracketAccessUnlocked ? "true" : "false");
}

function unlockBracketAccessWithPassword(password) {
  if (password !== ADMIN_PASSWORD) return false;
  isBracketAccessUnlocked = true;
  sessionStorage.setItem("chobeoneBracketAccessUnlocked", "true");
  unlockAdminWithPassword(password);
  updateBracketAccessUi();
  return true;
}

function closeAdminDialog(unlocked = false) {
  if (adminModalBackdrop) {
    adminModalBackdrop.classList.remove("open");
    adminModalBackdrop.setAttribute("aria-hidden", "true");
  }

  if (pendingAdminResolver) {
    pendingAdminResolver(unlocked);
    pendingAdminResolver = null;
  }
}

function requestAdminAccess() {
  if (isAdminUnlocked) return Promise.resolve(true);
  if (!adminModalBackdrop || !adminAccessForm || !adminPasswordInput) return Promise.resolve(false);

  if (pendingAdminResolver) closeAdminDialog(false);
  if (adminErrorText) adminErrorText.textContent = "";
  adminPasswordInput.value = "";
  adminModalBackdrop.classList.add("open");
  adminModalBackdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => adminPasswordInput.focus(), 50);

  return new Promise((resolve) => {
    pendingAdminResolver = resolve;
  });
}

/* ==========================================================================
   Skeleton Loading States (Rule: Always implement skeleton loading)
   ========================================================================== */
function renderSkeletonState() {
  // Skeleton Initial Matches
  initialMatchTable.innerHTML = Array.from({ length: 8 }, () => `
    <div class="skeleton-match-card">
      <div class="skeleton-shimmer skeleton-box" style="width: 36px; border-radius: 6px;"></div>
      <div class="skeleton-shimmer skeleton-box" style="border-radius: 6px;"></div>
      <div style="text-align: center; color: rgba(255,255,255,0.2); font-weight: 800; font-size: 0.65rem;">VS</div>
      <div class="skeleton-shimmer skeleton-box" style="border-radius: 6px;"></div>
    </div>
  `).join("");

  // Skeleton Bracket Trees
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

  hBracket.innerHTML = createTreeSkeleton();
  lBracket.innerHTML = createTreeSkeleton();
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
    : (escapeHtml(team.playerOne || team.playerTwo) || "Unassigned Players");
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
  const matches = seedTeamsForMatches(teams);
  const results = getCategoryResults(getCurrentCategory());

  initialMatchTable.innerHTML = matches.map((match) => {
    const winner = pickWinner(match, results.initial[match.match]);
    const loser = getMatchLoser(match, winner);

    return `
    <button type="button" class="match-card result-match-card${hasPlayableTeams(match) ? "" : " is-locked"}" data-stage="initial" data-match="${match.match}" ${hasPlayableTeams(match) ? "" : "disabled"}>
      <div class="match-index-badge">
        <span>M</span>
        0${match.match}
      </div>
      ${renderTeamSlot(match.teamA, `A${match.match}`, winner, isSameTeam(match.teamA, winner) ? "W" : (isSameTeam(match.teamA, loser) ? "L" : ""))}
      <div class="match-vs-divider">VS</div>
      ${renderTeamSlot(match.teamB, `B${match.match}`, winner, isSameTeam(match.teamB, winner) ? "W" : (isSameTeam(match.teamB, loser) ? "L" : ""))}
    </button>
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

    if (winner) hSeeds[match.match - 1] = winner;
    if (loser) lSeeds[match.match - 1] = loser;
  });

  return { H: hSeeds, L: lSeeds };
}

function buildDivisionMatches(seeds, results, prefix) {
  const qf = Array.from({ length: 4 }, (_, index) => ({
    id: `QF-${index + 1}`,
    code: `Match QF-${index + 1}`,
    status: "Set of 1",
    teamA: seeds[index * 2],
    teamB: seeds[index * 2 + 1]
  }));
  const qfWinners = qf.map((match) => pickWinner(match, results[prefix][match.id]));
  const sf = Array.from({ length: 2 }, (_, index) => ({
    id: `SF-${index + 1}`,
    code: `Semifinal ${index + 1}`,
    status: "Knockout",
    teamA: qfWinners[index * 2],
    teamB: qfWinners[index * 2 + 1]
  }));
  const sfWinners = sf.map((match) => pickWinner(match, results[prefix][match.id]));
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

function renderTreeSlot(team, fallbackTag, fallbackLabel, selectedTeam = null) {
  const isWinner = selectedTeam && isSameTeam(team, selectedTeam);
  const slotClass = `tree-team-slot${team ? "" : " is-empty"}${isWinner ? " is-winner" : ""}`;
  const label = team ? team.teamName : fallbackLabel;
  const tag = team ? (team.isBye ? "BYE" : `#${team.seed}`) : fallbackTag;

  return `
    <div class="${slotClass}">
      <div class="slot-identity">
        <span class="slot-tag">${escapeHtml(tag)}</span>
        <span class="slot-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      </div>
    </div>
  `;
}

function renderDivisionMatch(match, prefix, fallbackA, fallbackB, selectedTeam = null) {
  const canDeclare = hasPlayableTeams(match);
  return `
    <button type="button" class="tree-match-node result-match-card${canDeclare ? "" : " is-locked"}" data-stage="division" data-prefix="${prefix}" data-match="${escapeHtml(match.id)}" ${canDeclare ? "" : "disabled"}>
      <div class="tree-match-head">
        <span class="match-code">${escapeHtml(match.code)}</span>
        <span class="slot-status-pill">${escapeHtml(match.status)}</span>
      </div>
      ${renderTreeSlot(match.teamA, fallbackA.tag, fallbackA.label, selectedTeam)}
      ${renderTreeSlot(match.teamB, fallbackB.tag, fallbackB.label, selectedTeam)}
    </button>
  `;
}

function renderBracket(container, prefix) {
  const divisionTitle = prefix === "H" ? "Championship H" : "Consolation L";
  const teams = teamsByCategory[getCurrentCategory()] || [];
  const results = getCategoryResults(getCurrentCategory());
  const divisionSeeds = buildInitialRoutes(teams, results)[prefix];
  const divisionMatches = buildDivisionMatches(divisionSeeds, results, prefix);

  // Quarterfinals (4 matches with 2 teams each)
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

  // Podium Showcase
  const championPodium = `
    <div class="champion-podium">
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
   Category & Capacity Management
   ========================================================================== */
function renderCategory(categoryName, notifyUser = false) {
  const teams = teamsByCategory[categoryName] || [];
  const percentFilled = Math.min(Math.round((teams.length / MAX_TEAMS) * 100), 100);

  bracketCount.textContent = `${teams.length} / ${MAX_TEAMS} Teams Registered`;
  if (capacityFill) {
    capacityFill.style.width = `${percentFilled}%`;
  }

  renderInitialMatches(teams);
  renderBracket(hBracket, "H");
  renderBracket(lBracket, "L");

  if (notifyUser) {
    showToast("info", `Switched to: ${getCategoryDisplayName(categoryName)} (${teams.length} teams)`);
  }
}

function findInitialMatch(matchNumber) {
  const teams = teamsByCategory[getCurrentCategory()] || [];
  return seedTeamsForMatches(teams).find((match) => String(match.match) === String(matchNumber));
}

function findDivisionMatch(prefix, matchId) {
  const teams = teamsByCategory[getCurrentCategory()] || [];
  const results = getCategoryResults(getCurrentCategory());
  const divisionSeeds = buildInitialRoutes(teams, results)[prefix];
  const divisionMatches = buildDivisionMatches(divisionSeeds, results, prefix);
  return [...divisionMatches.qf, ...divisionMatches.sf, divisionMatches.final].find((match) => match.id === matchId);
}

function closeWinnerDialog(winner = null) {
  if (resultModalBackdrop) {
    resultModalBackdrop.classList.remove("open");
    resultModalBackdrop.setAttribute("aria-hidden", "true");
  }

  if (pendingWinnerResolver) {
    pendingWinnerResolver(winner);
    pendingWinnerResolver = null;
  }
  resultDialogTeams = [];
}

function askWinner(match) {
  if (!hasPlayableTeams(match)) return null;

  if (!resultModalBackdrop || !resultWinnerOptions) {
    return Promise.resolve(window.confirm(`${match.teamA.teamName} wins?`) ? match.teamA : match.teamB);
  }

  if (pendingWinnerResolver) closeWinnerDialog(null);

  resultModalCategory.textContent = getCategoryDisplayName(getCurrentCategory());
  resultModalTitle.textContent = match.code || `Match ${match.match}`;
  resultModalDesc.textContent = "Choose the winning team. The bracket will move the winner and loser automatically.";
  resultDialogTeams = [match.teamA, match.teamB];
  resultWinnerOptions.innerHTML = [match.teamA, match.teamB].map((team, index) => `
    <button type="button" class="result-winner-btn" data-team-index="${index}">
      <span class="result-winner-seed">#${team.seed}</span>
      <span class="result-winner-name">${escapeHtml(team.teamName)}</span>
      <span class="result-winner-players">${escapeHtml([team.playerOne, team.playerTwo].filter(Boolean).join(" & "))}</span>
    </button>
  `).join("");

  resultModalBackdrop.classList.add("open");
  resultModalBackdrop.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    pendingWinnerResolver = resolve;
  });
}

function clearDivisionResults(results, prefix, fromMatchId = "") {
  if (!fromMatchId || fromMatchId.startsWith("QF-")) {
    const qfNumber = Number(fromMatchId.replace("QF-", ""));
    if (!fromMatchId || qfNumber <= 2) delete results[prefix]["SF-1"];
    if (!fromMatchId || qfNumber >= 3) delete results[prefix]["SF-2"];
    delete results[prefix].FINAL;
  } else if (fromMatchId.startsWith("SF-")) {
    delete results[prefix].FINAL;
  }
}

async function declareInitialWinner(matchNumber) {
  if (!await requestAdminAccess()) return;

  const match = findInitialMatch(matchNumber);
  const winner = await askWinner(match);
  if (!winner) return;

  const categoryName = getCurrentCategory();
  const results = getCategoryResults(categoryName);
  results.initial[match.match] = winner.id;
  results.H = {};
  results.L = {};
  saveBracketResults();
  renderCategory(categoryName);

  const loser = getMatchLoser(match, winner);
  showToast("success", `${winner.teamName} moved to H Seed ${match.match}${loser ? `, ${loser.teamName} moved to L Seed ${match.match}` : ""}.`);
}

async function declareDivisionWinner(prefix, matchId) {
  if (!await requestAdminAccess()) return;

  const match = findDivisionMatch(prefix, matchId);
  const winner = await askWinner(match);
  if (!winner) return;

  const categoryName = getCurrentCategory();
  const results = getCategoryResults(categoryName);
  results[prefix][match.id] = winner.id;
  clearDivisionResults(results, prefix, match.id);
  saveBracketResults();
  renderCategory(categoryName);
  showToast("success", `${winner.teamName} advanced in the ${prefix} Bracket.`);
}

/* ==========================================================================
   Smooth Custom Dropdown Component (UX & Full Inertial Capabilities)
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
    const teams = teamsByCategory[category] || [];
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
      selectCategory(category, true);
      closeCustomDropdown();
    });

    dropdownMenu.appendChild(li);
  });

  if (dropdownSelectedText && categorySelect && categorySelect.value) {
    dropdownSelectedText.textContent = getCategoryDisplayName(categorySelect.value);
  }
}

function selectCategory(categoryName, notifyUser = false) {
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

  renderCategory(categoryName, notifyUser);
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
   Data Synchronization & Loading
   ========================================================================== */
async function loadBracketData(isManualRefresh = false) {
  if (isFetching) return;
  isFetching = true;

  // Render Skeleton Shimmers while fetching
  renderSkeletonState();
  bracketCount.textContent = "Syncing live teams...";

  if (refreshButton) {
    refreshButton.classList.add("is-loading");
    refreshButton.disabled = true;
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message || "Unable to load bracket data.");
    }

    teamsByCategory = result.teamsByCategory || {};
    renderCategory(categorySelect.value);
    renderCustomDropdownOptions();

    if (isManualRefresh) {
      showToast("success", "Tournament brackets refreshed successfully.");
    }
  } catch (error) {
    console.error("Bracket load error:", error);
    bracketCount.textContent = "Unable to connect to live registrations.";
    teamsByCategory = {};
    renderCategory(categorySelect.value);
    renderCustomDropdownOptions();
    showToast("error", "Unable to sync registrations. Using offline placeholders.");
  } finally {
    isFetching = false;
    if (refreshButton) {
      refreshButton.classList.remove("is-loading");
      refreshButton.disabled = false;
    }
  }
}

/* ==========================================================================
   Stage Navigation Tabs (Responsive & Accessibility)
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

    if (window.innerWidth <= 960) {
      // On mobile and tablet, filter visible stages
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
      } else if (stage === "h-bracket") {
        if (eliminationSidebar) eliminationSidebar.style.display = "none";
        if (stageInitial) stageInitial.style.display = "none";
        if (stageBrackets) stageBrackets.style.display = "";
        if (stageHBracket) stageHBracket.style.display = "";
        if (stageLBracket) stageLBracket.style.display = "none";
        if (stageRules) stageRules.style.display = "none";
      } else if (stage === "l-bracket") {
        if (eliminationSidebar) eliminationSidebar.style.display = "none";
        if (stageInitial) stageInitial.style.display = "none";
        if (stageBrackets) stageBrackets.style.display = "";
        if (stageHBracket) stageHBracket.style.display = "none";
        if (stageLBracket) stageLBracket.style.display = "";
        if (stageRules) stageRules.style.display = "none";
      } else if (stage === "rules") {
        if (eliminationSidebar) eliminationSidebar.style.display = "";
        if (stageInitial) stageInitial.style.display = "none";
        if (stageBrackets) stageBrackets.style.display = "none";
        if (stageRules) stageRules.style.display = "";
      }
    } else {
      // On desktop, smooth scroll to the target section
      let targetElement = null;
      if (stage === "initial") targetElement = stageInitial;
      else if (stage === "h-bracket") targetElement = stageHBracket;
      else if (stage === "l-bracket") targetElement = stageLBracket;
      else if (stage === "rules") targetElement = stageRules;
      else if (stage === "all") targetElement = document.querySelector(".bracket-hero");

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
});

// Responsive resize listener for stage tabs
window.addEventListener("resize", () => {
  if (window.innerWidth > 960) {
    if (eliminationSidebar) eliminationSidebar.style.display = "";
    if (stageInitial) stageInitial.style.display = "";
    if (stageBrackets) stageBrackets.style.display = "";
    if (stageHBracket) stageHBracket.style.display = "";
    if (stageLBracket) stageLBracket.style.display = "";
    if (stageRules) stageRules.style.display = "";
  }
});

// Event Listeners
if (dropdownTrigger) {
  dropdownTrigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCustomDropdown();
  });
}

// Close dropdown when clicking outside
document.addEventListener("click", (event) => {
  if (customDropdown && !customDropdown.contains(event.target)) {
    closeCustomDropdown();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && resultModalBackdrop && resultModalBackdrop.classList.contains("open")) {
    closeWinnerDialog(null);
  }
  if (event.key === "Escape" && adminModalBackdrop && adminModalBackdrop.classList.contains("open")) {
    closeAdminDialog(false);
  }
});

// Keyboard navigation for dropdown accessibility
if (customDropdown) {
  customDropdown.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCustomDropdown();
    } else if (e.key === "Enter" || e.key === " ") {
      if (!customDropdown.classList.contains("open")) {
        e.preventDefault();
        openCustomDropdown();
      } else {
        const highlighted = dropdownMenu ? dropdownMenu.querySelector(".dropdown-option.highlighted") : null;
        if (highlighted && highlighted.dataset.value) {
          e.preventDefault();
          selectCategory(highlighted.dataset.value, true);
          closeCustomDropdown();
        }
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!customDropdown.classList.contains("open")) {
        openCustomDropdown();
        return;
      }
      if (!dropdownMenu) return;
      const items = Array.from(dropdownMenu.querySelectorAll(".dropdown-option"));
      if (items.length === 0) return;
      const currentIndex = items.findIndex((item) => item.classList.contains("highlighted"));
      let nextIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex >= items.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = items.length - 1;

      items.forEach((i) => i.classList.remove("highlighted"));
      items[nextIndex].classList.add("highlighted");
      items[nextIndex].scrollIntoView({ block: "nearest" });
    }
  });
}

if (categorySelect) {
  categorySelect.addEventListener("change", () => selectCategory(categorySelect.value, true));
}
if (refreshButton) {
  refreshButton.addEventListener("click", () => loadBracketData(true));
}
if (adminAccessBtn) {
  adminAccessBtn.addEventListener("click", () => {
    if (isAdminUnlocked) {
      showToast("info", "Admin access is already active for this session.");
      return;
    }
    requestAdminAccess();
  });
}
if (resultWinnerOptions) {
  resultWinnerOptions.addEventListener("click", (event) => {
    const option = event.target.closest(".result-winner-btn");
    if (!option) return;
    const teamIndex = Number(option.dataset.teamIndex);
    closeWinnerDialog(resultDialogTeams[teamIndex] || null);
  });
}
if (resultModalClose) {
  resultModalClose.addEventListener("click", () => closeWinnerDialog(null));
}
if (resultModalCancel) {
  resultModalCancel.addEventListener("click", () => closeWinnerDialog(null));
}
if (resultModalBackdrop) {
  resultModalBackdrop.addEventListener("click", (event) => {
    if (event.target === resultModalBackdrop) closeWinnerDialog(null);
  });
}
if (adminModalClose) {
  adminModalClose.addEventListener("click", () => closeAdminDialog(false));
}
if (adminModalCancel) {
  adminModalCancel.addEventListener("click", () => closeAdminDialog(false));
}
if (adminModalBackdrop) {
  adminModalBackdrop.addEventListener("click", (event) => {
    if (event.target === adminModalBackdrop) closeAdminDialog(false);
  });
}
if (adminAccessForm) {
  adminAccessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (unlockAdminWithPassword(adminPasswordInput.value)) {
      closeAdminDialog(true);
      showToast("success", "Admin access unlocked.");
      return;
    }

    if (adminErrorText) adminErrorText.textContent = "Incorrect password.";
    adminPasswordInput.select();
  });
}
if (bracketAccessForm) {
  bracketAccessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (unlockBracketAccessWithPassword(bracketAccessPasswordInput.value)) {
      showToast("success", "Bracketing access unlocked.");
      return;
    }

    if (bracketAccessErrorText) bracketAccessErrorText.textContent = "Incorrect password.";
    bracketAccessPasswordInput.select();
  });
}
if (bracketAccessCancel) {
  bracketAccessCancel.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
if (initialMatchTable) {
  initialMatchTable.addEventListener("click", (event) => {
    const matchCard = event.target.closest(".result-match-card");
    if (!matchCard || matchCard.disabled) return;
    declareInitialWinner(matchCard.dataset.match);
  });
}
[hBracket, lBracket].forEach((container) => {
  if (!container) return;
  container.addEventListener("click", (event) => {
    const matchCard = event.target.closest(".result-match-card");
    if (!matchCard || matchCard.disabled) return;
    declareDivisionWinner(matchCard.dataset.prefix, matchCard.dataset.match);
  });
});

// Initialize Application
populateCategorySelect();
updateAdminAccessUi();
updateBracketAccessUi();
if (!isBracketAccessUnlocked && bracketAccessPasswordInput) {
  setTimeout(() => bracketAccessPasswordInput.focus(), 50);
}
renderBracket(hBracket, "H");
renderBracket(lBracket, "L");
loadBracketData(false);
