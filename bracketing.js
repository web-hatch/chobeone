const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzi2CP7aG4bbH9fL5ZRqwtq-O10W9zK_COYd6VNhsjCtWbJxKpBQsuMlLlxME5Sdpbl/exec";
const MAX_TEAMS = 16;
const CATEGORIES = [
  "Novice Low Men's Doubles",
  "Novice High Men's Doubles",
  "Novice Low Women's Doubles",
  "Novice High Women's Doubles",
  "Novice Low Mixed Doubles",
  "Novice High Mixed Doubles",
  "Open Doubles"
];

const categorySelect = document.querySelector("#bracketCategorySelect");
const bracketCount = document.querySelector("#bracketCount");
const initialMatchTable = document.querySelector("#initialMatchTable");
const hBracket = document.querySelector("#hBracket");
const lBracket = document.querySelector("#lBracket");
const refreshButton = document.querySelector("#refreshBracketBtn");

let teamsByCategory = {};

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

function normalizeTeam(team, index) {
  return {
    seed: team.seed || index + 1,
    teamName: team.teamName || `Team ${index + 1}`,
    playerOne: team.playerOne || "",
    playerTwo: team.playerTwo || ""
  };
}

function createTeamLabel(team, fallback) {
  if (!team) {
    return `<strong>${fallback}</strong><span>Waiting for registration</span>`;
  }

  return `<strong>${escapeHtml(team.teamName)}</strong><span>${escapeHtml(team.playerOne)} / ${escapeHtml(team.playerTwo)}</span>`;
}

function seedTeamsForMatches(teams) {
  const slots = Array.from({ length: MAX_TEAMS }, (_, index) => teams[index] ? normalizeTeam(teams[index], index) : null);

  return Array.from({ length: 8 }, (_, index) => ({
    match: index + 1,
    teamA: slots[index],
    teamB: slots[index + 8]
  }));
}

function renderInitialMatches(teams) {
  const matches = seedTeamsForMatches(teams);
  initialMatchTable.innerHTML = matches.map((match) => `
    <div class="match-row">
      <div class="match-cell match-number">${match.match}</div>
      <div class="match-cell team-cell">${createTeamLabel(match.teamA, `A${match.match}`)}</div>
      <div class="match-cell match-vs">VS</div>
      <div class="match-cell team-cell">${createTeamLabel(match.teamB, `B${match.match}`)}</div>
    </div>
  `).join("");
}

function renderBracket(container, prefix) {
  const qfSlots = Array.from({ length: 8 }, (_, index) => `
    <div class="bracket-slot"><span class="slot-prefix">${prefix}${index + 1}</span><span>${prefix} ${index + 1}</span></div>
  `).join("");
  const sfSlots = Array.from({ length: 4 }, (_, index) => `
    <div class="bracket-slot"><span>Winner ${prefix}${index * 2 + 1}-${prefix}${index * 2 + 2}</span></div>
  `).join("");
  const finalSlots = Array.from({ length: 2 }, (_, index) => `
    <div class="bracket-slot"><span>Finalist ${index + 1}</span></div>
  `).join("");

  container.innerHTML = `
    <div class="round">
      <div class="round-title">Quarterfinals</div>
      ${qfSlots}
    </div>
    <div class="round">
      <div class="round-title">Semifinals</div>
      ${sfSlots}
    </div>
    <div class="round">
      <div class="round-title">Final</div>
      ${finalSlots}
    </div>
    <div class="champion-box">${prefix} Bracket<br>Champion</div>
  `;
}

function renderCategory(categoryName) {
  const teams = teamsByCategory[categoryName] || [];
  bracketCount.textContent = `${teams.length}/${MAX_TEAMS} teams registered`;
  renderInitialMatches(teams);
  renderBracket(hBracket, "H");
  renderBracket(lBracket, "L");
}

function populateCategorySelect() {
  categorySelect.innerHTML = CATEGORIES.map((category) => `
    <option value="${escapeHtml(category)}">${escapeHtml(getCategoryDisplayName(category))}</option>
  `).join("");
  categorySelect.value = CATEGORIES[0];
}

async function loadBracketData() {
  bracketCount.textContent = "Loading teams...";

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message || "Unable to load bracket data.");
    }

    teamsByCategory = result.teamsByCategory || {};
    renderCategory(categorySelect.value);
  } catch (error) {
    bracketCount.textContent = "Unable to load live registrations.";
    teamsByCategory = {};
    renderCategory(categorySelect.value);
  }
}

categorySelect.addEventListener("change", () => renderCategory(categorySelect.value));
refreshButton.addEventListener("click", loadBracketData);

populateCategorySelect();
renderBracket(hBracket, "H");
renderBracket(lBracket, "L");
loadBracketData();
