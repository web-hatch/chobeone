const SHEET_NAME = "Registrations";
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

const HEADERS = [
  "Timestamp",
  "Event Name",
  "Team Name",
  "Category",
  "Player 1",
  "Player 1 ID No.",
  "Player 1 Photo",
  "Player 2",
  "Player 2 ID No.",
  "Player 2 Photo",
  "Contact Number",
  "Email"
];

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(10000)) {
      return json_({ ok: false, message: "Registration is busy. Please wait a moment and try again." });
    }
    const data = e.parameter || {};
    if (data.action === "updateTournamentControls") {
      return json_(updateTournamentControls_(data));
    }
    if (data.action === "saveBracketResults") {
      return json_(saveBracketResults_(data));
    }
    if (!getTournamentControls_().registrationOpen) {
      throw new Error("Registration is closed. Please contact the organizer for an extension.");
    }
    const sheet = getRegistrationSheet_();

    validateRequired_(data, [
      "teamName",
      "category",
      "playerOne",
      "playerOneId",
      "playerOnePhotoData",
      "playerTwo",
      "playerTwoId",
      "playerTwoPhotoData",
      "contactNumber",
      "email"
    ]);

    const category = getCanonicalCategoryName_(data.category);
    if (!category) {
      throw new Error("Invalid category bracket.");
    }

    validateDuplicates_(sheet, data, getTournamentControls_().duplicateEntryAllowed === true);

    if (isCategoryFull_(sheet, category)) {
      throw new Error("This category is already full. Please select another category.");
    }

    const photoFolder = getPhotoFolder_();
    const playerOnePhotoUrl = savePhoto_(photoFolder, data.playerOnePhotoData, data.playerOnePhotoName, data.playerOnePhotoType, data.playerOne, data.playerOneId);
    const playerTwoPhotoUrl = savePhoto_(photoFolder, data.playerTwoPhotoData, data.playerTwoPhotoName, data.playerTwoPhotoType, data.playerTwo, data.playerTwoId);

    sheet.appendRow([
      data.submittedAt || new Date(),
      data.eventName || "Cho-Be-One Mini Pickleball Tournament",
      data.teamName,
      category,
      data.playerOne,
      data.playerOneId,
      playerOnePhotoUrl,
      data.playerTwo,
      data.playerTwoId,
      playerTwoPhotoUrl,
      data.contactNumber,
      data.email || ""
    ]);

    return json_({
      ok: true,
      message: "Registration saved.",
      maxTeamsPerCategory: MAX_TEAMS_PER_CATEGORY,
      categories: getCategoryAvailability_(sheet)
    });
  } catch (error) {
    return json_({ ok: false, message: error.message, tournamentControls: getTournamentControls_() });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doGet() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) return json_({ ok: false, message: "Tournament data is busy. Please refresh shortly." });
    const sheet = getRegistrationSheet_();

    return json_({
      ok: true,
      message: "Cho-Be-One registration API is online.",
      maxTeamsPerCategory: MAX_TEAMS_PER_CATEGORY,
      tournamentControls: getTournamentControls_(),
      matchingTeamsByCategory: getMatchingTeams_(),
      bracketState: getBracketState_(),
      categories: getCategoryAvailability_(sheet),
      teamsByCategory: getTeamsByCategory_(sheet)
    });
  } catch (error) {
    return json_({ ok: false, message: error.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getTournamentControls_() {
  const defaults = { registrationOpen: true, matchingLocked: false, duplicateEntryAllowed: false, revision: 0 };
  const saved = PropertiesService.getScriptProperties().getProperty("tournamentControls");
  return Object.assign(defaults, saved ? JSON.parse(saved) : {});
}

function getMatchingTeams_() {
  if (!getTournamentControls_().matchingLocked) return null;
  const properties = PropertiesService.getScriptProperties();
  const teams = {};
  CATEGORIES.forEach((category, index) => {
    teams[category] = JSON.parse(properties.getProperty("matchingTeams" + index) || "[]");
  });
  return teams;
}

function requireTournamentPassword_(data) {
  const properties = PropertiesService.getScriptProperties();
  const password = properties.getProperty("TOURNAMENT_ADMIN_PASSWORD");
  if (!password) throw new Error("Set TOURNAMENT_ADMIN_PASSWORD in Apps Script project settings first.");
  if (data.adminPassword !== password) throw new Error("Incorrect tournament admin password.");
}

function getBracketSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName("BracketResults") || spreadsheet.insertSheet("BracketResults");
  if (!sheet.getLastRow()) {
    sheet.appendRow(["Category", "Results JSON", "Revision", "Updated At"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getBracketState_() {
  const sheet = getBracketSheet_();
  const state = { results: {}, revisions: {} };
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues().forEach(row => {
      if (!CATEGORIES.includes(row[0])) return;
      state.results[row[0]] = JSON.parse(row[1]);
      state.revisions[row[0]] = Number(row[2]);
    });
  }
  return state;
}

function saveBracketResults_(data) {
  if (!CATEGORIES.includes(data.category)) throw new Error("Invalid category.");
  const controls = getTournamentControls_();
  const state = getBracketState_();
  if (String(controls.revision) !== String(data.controlsRevision) ||
      String(state.revisions[data.category] || 0) !== String(data.revision)) {
    throw new Error("Brackets changed on another device. Refresh Data and try again.");
  }
  const results = JSON.parse(data.results || "null");
  if (!results || typeof results !== "object" || Array.isArray(results) ||
      Object.keys(results).some(key => !["initial", "H", "L"].includes(key))) throw new Error("Invalid results.");
  ["initial", "H", "L"].forEach(stage => {
    const matches = results[stage];
    if (!matches || typeof matches !== "object" || Array.isArray(matches) || Object.keys(matches).length > 8) {
      throw new Error("Invalid match results.");
    }
    Object.keys(matches).forEach(id => {
      const validId = stage === "initial" ? /^[1-8]$/.test(id) : /^(QF-[1-4]|SF-[12]|FINAL)$/.test(id);
      if (!validId || !["string", "number"].includes(typeof matches[id]) || String(matches[id]).length > 500) {
        throw new Error("Invalid winner.");
      }
    });
  });
  const sheet = getBracketSheet_();
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(row => row[0] === data.category);
  const revision = (state.revisions[data.category] || 0) + 1;
  const row = [data.category, JSON.stringify(results), revision, new Date()];
  if (index < 0) sheet.appendRow(row);
  else sheet.getRange(index + 1, 1, 1, 4).setValues([row]);
  return { ok: true, bracketState: getBracketState_() };
}

function updateTournamentControls_(data) {
  requireTournamentPassword_(data);
  const properties = PropertiesService.getScriptProperties();
  const controls = getTournamentControls_();
  if (String(controls.revision) !== String(data.revision)) {
    throw new Error("Controls changed on another device. Refresh Data and try again.");
  }
  if (!["registrationOpen", "matchingLocked", "duplicateEntryAllowed"].includes(data.control) || !["true", "false"].includes(data.value)) {
    throw new Error("Invalid tournament control.");
  }
  if (data.control === "matchingLocked" && data.value === "true" && !controls.matchingLocked) {
    const teams = getTeamsByCategory_(getRegistrationSheet_());
    const snapshot = {};
    CATEGORIES.forEach((category, index) => {
      snapshot["matchingTeams" + index] = JSON.stringify(teams[category]);
    });
    properties.setProperties(snapshot);
  }
  controls[data.control] = data.value === "true";
  controls.revision += 1;
  properties.setProperty("tournamentControls", JSON.stringify(controls));
  return { ok: true, tournamentControls: controls, matchingTeamsByCategory: getMatchingTeams_() };
}

function getRegistrationSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  if (sheet.getMaxColumns() > HEADERS.length) {
    sheet.deleteColumns(HEADERS.length + 1, sheet.getMaxColumns() - HEADERS.length);
  }

  sheet.setFrozenRows(1);

  return sheet;
}

function getCategoryAvailability_(sheet) {
  const counts = getCategoryTeamCounts_(sheet);

  return CATEGORIES.map((name) => {
    const registeredTeams = counts[name] || 0;
    const remainingSlots = Math.max(MAX_TEAMS_PER_CATEGORY - registeredTeams, 0);

    return {
      name: name,
      registeredTeams: registeredTeams,
      remainingSlots: remainingSlots,
      full: remainingSlots < 1
    };
  });
}

function isCategoryFull_(sheet, categoryName) {
  const counts = getCategoryTeamCounts_(sheet);
  const registeredTeams = counts[categoryName] || 0;

  return registeredTeams + 1 > MAX_TEAMS_PER_CATEGORY;
}

function getCategoryTeamCounts_(sheet) {
  const counts = {};
  const rows = sheet.getDataRange().getValues();

  if (rows.length < 2) {
    return counts;
  }

  const categoryColumn = rows[0].indexOf("Category");

  if (categoryColumn === -1) {
    return counts;
  }

  rows.slice(1).forEach((row) => {
    const category = getCanonicalCategoryName_(row[categoryColumn]);

    if (category) {
      counts[category] = (counts[category] || 0) + 1;
    }
  });

  return counts;
}

function getTeamsByCategory_(sheet) {
  const teamsByCategory = {};
  CATEGORIES.forEach((category) => teamsByCategory[category] = []);

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) {
    return teamsByCategory;
  }

  const headers = rows[0];
  const indexes = {
    timestamp: headers.indexOf("Timestamp"),
    teamName: headers.indexOf("Team Name"),
    category: headers.indexOf("Category"),
    playerOne: headers.indexOf("Player 1"),
    playerOneId: headers.indexOf("Player 1 ID No."),
    playerTwo: headers.indexOf("Player 2"),
    playerTwoId: headers.indexOf("Player 2 ID No.")
  };

  if (indexes.category === -1 || indexes.teamName === -1) {
    return teamsByCategory;
  }

  rows.slice(1).forEach((row, index) => {
    const category = getCanonicalCategoryName_(row[indexes.category]);
    if (!category || !teamsByCategory[category]) {
      return;
    }

    teamsByCategory[category].push({
      seed: teamsByCategory[category].length + 1,
      rowNumber: index + 2,
      timestamp: indexes.timestamp > -1 ? row[indexes.timestamp] : "",
      teamName: row[indexes.teamName],
      playerOne: indexes.playerOne > -1 ? row[indexes.playerOne] : "",
      playerOneId: indexes.playerOneId > -1 ? row[indexes.playerOneId] : "",
      playerTwo: indexes.playerTwo > -1 ? row[indexes.playerTwo] : "",
      playerTwoId: indexes.playerTwoId > -1 ? row[indexes.playerTwoId] : ""
    });
  });

  return teamsByCategory;
}

function getPhotoFolder_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const parent = DriveApp.getFileById(spreadsheet.getId()).getParents();
  const root = parent.hasNext() ? parent.next() : DriveApp.getRootFolder();
  const folderName = "Cho-Be-One Player Photos";
  const folders = root.getFoldersByName(folderName);

  return folders.hasNext() ? folders.next() : root.createFolder(folderName);
}

function savePhoto_(folder, base64Data, originalName, mimeType, playerName, playerId) {
  if (!base64Data) {
    return "";
  }

  const safeName = [playerName, playerId, originalName || "photo"]
    .join("-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType || "image/jpeg", safeName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

function normalizeRegistrationValue_(value) {
  return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePlayerName_(value) {
  const words = normalizeRegistrationValue_(value).replace(/[^a-z0-9\s]/g, "").split(" ").filter(Boolean);
  return words.filter((word, index) => words.length <= 1 || !(word.length === 1 && index > 0 && index < words.length - 1)).join(" ");
}

function validateDuplicates_(sheet, data, duplicateEntryAllowed) {
  const names = [data.playerOne, data.playerTwo].map(normalizePlayerName_);
  const ids = [data.playerOneId, data.playerTwoId].map(normalizeRegistrationValue_);
  const teamName = normalizeRegistrationValue_(data.teamName);

  if (names[0] && names[0] === names[1]) {
    throw new Error("Player 1 and Player 2 cannot be the same person.");
  }
  if (ids[0] === ids[1]) {
    throw new Error("Player 1 and Player 2 cannot use the same ID No.");
  }

  const rows = sheet.getDataRange().getDisplayValues();
  const headers = rows[0];
  const teamColumn = headers.indexOf("Team Name");
  const nameColumns = [headers.indexOf("Player 1"), headers.indexOf("Player 2")];
  const idColumns = [headers.indexOf("Player 1 ID No."), headers.indexOf("Player 2 ID No.")];

  rows.slice(1).forEach((row) => {
    if (teamName === normalizeRegistrationValue_(row[teamColumn])) {
      throw new Error("This team name is already registered. Please use a different team name.");
    }
    if (!duplicateEntryAllowed) {
      names.forEach((name, index) => {
        if (name && nameColumns.some((column) => name === normalizePlayerName_(row[column]))) {
          throw new Error("Player " + (index + 1) + " name is already registered. Each player can only join 1 team & category.");
        }
      });
      ids.forEach((id, index) => {
        if (id && idColumns.some((column) => id === normalizeRegistrationValue_(row[column]))) {
          throw new Error("Player " + (index + 1) + " ID No. is already registered.");
        }
      });
    }
  });
}

function validateRequired_(data, fields) {
  fields.forEach((field) => {
    if (!data[field] || String(data[field]).trim() === "") {
      throw new Error("Missing required field: " + field);
    }
  });
}

function getCanonicalCategoryName_(value) {
  const raw = String(value || "").trim();

  return CATEGORIES.find((category) => {
    return raw === category ||
      raw === getCategoryDisplayName_(category) ||
      raw.indexOf(category + " - ") === 0 ||
      raw.indexOf(getCategoryDisplayName_(category) + " - ") === 0;
  }) || "";
}

function getCategoryDisplayName_(categoryName) {
  return categoryName === "Open Doubles"
    ? "Open Doubles (Intermediate & Advance)"
    : categoryName;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
