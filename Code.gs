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
  lock.waitLock(10000);

  try {
    const sheet = getRegistrationSheet_();
    const data = e.parameter || {};

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
    return json_({ ok: false, message: error.message });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const sheet = getRegistrationSheet_();

  return json_({
    ok: true,
    message: "Cho-Be-One registration API is online.",
    maxTeamsPerCategory: MAX_TEAMS_PER_CATEGORY,
    categories: getCategoryAvailability_(sheet),
    teamsByCategory: getTeamsByCategory_(sheet)
  });
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
    playerTwo: headers.indexOf("Player 2")
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
      playerTwo: indexes.playerTwo > -1 ? row[indexes.playerTwo] : ""
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
