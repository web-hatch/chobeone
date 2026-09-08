const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzi2CP7aG4bbH9fL5ZRqwtq-O10W9zK_COYd6VNhsjCtWbJxKpBQsuMlLlxME5Sdpbl/exec";
const MAX_TEAMS_PER_CATEGORY = 16;
const ADMIN_PASSWORD = "Slasher15";

/* DOM Element References */
const form = document.querySelector("#registrationForm");
const statusMessage = document.querySelector("#statusMessage");
const submitButton = form.querySelector("button[type='submit']");
const categorySelect = document.querySelector("#categorySelect");
const categoryAvailability = document.querySelector("#categoryAvailability");
const successModal = document.querySelector("#successModal");
const closeSuccessModal = document.querySelector("#closeSuccessModal");
const confirmSuccessModal = document.querySelector("#confirmSuccessModal");
const viewOfficialTeamsModalBtn = document.querySelector("#viewOfficialTeamsModalBtn");
const portalAccessModal = document.querySelector("#portalAccessModal");
const closePortalAccessModal = document.querySelector("#closePortalAccessModal");
const cancelPortalAccessModal = document.querySelector("#cancelPortalAccessModal");
const portalAccessForm = document.querySelector("#portalAccessForm");
const portalPasswordInput = document.querySelector("#portalPasswordInput");
const portalAccessDesc = document.querySelector("#portalAccessDesc");
const portalErrorText = document.querySelector("#portalErrorText");
const toastContainer = document.querySelector("#toastContainer");

/* Custom Dropdown Elements */
const customDropdown = document.querySelector("#customDropdown");
const dropdownTrigger = document.querySelector("#dropdownTrigger");
const dropdownSelectedText = document.querySelector("#dropdownSelectedText");
const dropdownMenu = document.querySelector("#dropdownMenu");

/* File Inputs & Dropzones */
const playerOnePhotoInput = document.querySelector("#playerOnePhotoInput");
const dropzonePlayerOne = document.querySelector("#dropzonePlayerOne");
const tagPlayerOne = document.querySelector("#tagPlayerOne");

const playerTwoPhotoInput = document.querySelector("#playerTwoPhotoInput");
const dropzonePlayerTwo = document.querySelector("#dropzonePlayerTwo");
const tagPlayerTwo = document.querySelector("#tagPlayerTwo");

/* Category Cards Grid */
const categoryGrid = document.querySelector("#categoryGrid");

const categoryAvailabilityByName = new Map();
let existingTeamsByCategory = {};

function normalizePlayerName(str) {
  if (!str || typeof str !== "string") return "";
  const cleaned = str.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  return words.filter((w, idx) => {
    if (words.length <= 1) return true;
    return !(w.length === 1 && idx > 0 && idx < words.length - 1);
  }).join(" ");
}

function normalizeCategory(category) {
  const registeredTeams = Number(category.registeredTeams ?? category.registeredPlayers ?? 0);
  const remainingSlots = Number(category.remainingSlots ?? category.remainingPlayers ?? Math.max(MAX_TEAMS_PER_CATEGORY - registeredTeams, 0));

  return {
    ...category,
    registeredTeams,
    remainingSlots,
    full: Boolean(category.full || remainingSlots < 1)
  };
}

/* ==========================================================================
   Centralized Floating Toast System
   ========================================================================== */
function showToast(type, message, duration = 4200) {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");

  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-body">
      <span class="toast-icon" aria-hidden="true">${iconSvg}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  toastContainer.appendChild(toast);

  // Trigger smooth inertial entrance
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  const dismissToast = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => {
      toast.remove();
    }, { once: true });
  };

  const closeBtn = toast.querySelector(".toast-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", dismissToast);
  }

  if (duration > 0) {
    setTimeout(dismissToast, duration);
  }
}

function escapeHtml(string) {
  const div = document.createElement("div");
  div.textContent = string;
  return div.innerHTML;
}

function getCategoryDisplayName(categoryName) {
  return categoryName === "Open Doubles"
    ? "Open Doubles (Intermediate & Advance)"
    : categoryName;
}

function showStatus(type, message) {
  if (statusMessage) {
    statusMessage.hidden = false;
    statusMessage.className = `status-message ${type}`;
    statusMessage.textContent = message;
  }
  showToast(type, message);
}

/* ==========================================================================
   Loading & Modal Controls
   ========================================================================== */
function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("loading", isLoading);
  const textElem = submitButton.querySelector(".button-text");
  if (textElem) {
    textElem.textContent = isLoading ? "Submitting Registration..." : "Submit Team Registration";
  }
}

function openSuccessModal() {
  successModal.classList.add("open");
  successModal.setAttribute("aria-hidden", "false");
  confirmSuccessModal.focus();
}

function closeModal() {
  successModal.classList.remove("open");
  successModal.setAttribute("aria-hidden", "true");
}

let pendingPortalAction = "";

function openPortalAccessModal(action) {
  pendingPortalAction = action;
  if (portalAccessDesc) {
    portalAccessDesc.textContent = action === "bracketing"
      ? "Admin password is required to open tournament bracketing."
      : "Admin password is required for tournament management.";
  }
  if (portalErrorText) portalErrorText.textContent = "";
  if (portalPasswordInput) portalPasswordInput.value = "";
  portalAccessModal.classList.add("open");
  portalAccessModal.setAttribute("aria-hidden", "false");
  setTimeout(() => portalPasswordInput.focus(), 50);
}

function closePortalModal() {
  portalAccessModal.classList.remove("open");
  portalAccessModal.setAttribute("aria-hidden", "true");
  pendingPortalAction = "";
}

/* Modal action with loading spinner per user rule */
confirmSuccessModal.addEventListener("click", () => {
  confirmSuccessModal.classList.add("loading");
  confirmSuccessModal.disabled = true;
  setTimeout(() => {
    confirmSuccessModal.classList.remove("loading");
    confirmSuccessModal.disabled = false;
    closeModal();
  }, 350);
});

if (viewOfficialTeamsModalBtn) {
  viewOfficialTeamsModalBtn.addEventListener("click", () => {
    window.location.href = "official-teams.html";
  });
}

closeSuccessModal.addEventListener("click", closeModal);
successModal.addEventListener("click", (event) => {
  if (event.target === successModal) {
    closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && successModal.classList.contains("open")) {
    closeModal();
  }
  if (event.key === "Escape" && portalAccessModal.classList.contains("open")) {
    closePortalModal();
  }
});

if (closePortalAccessModal) {
  closePortalAccessModal.addEventListener("click", closePortalModal);
}

if (cancelPortalAccessModal) {
  cancelPortalAccessModal.addEventListener("click", closePortalModal);
}

if (portalAccessModal) {
  portalAccessModal.addEventListener("click", (event) => {
    if (event.target === portalAccessModal) {
      closePortalModal();
    }
  });
}

if (portalAccessForm) {
  portalAccessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (portalPasswordInput.value !== ADMIN_PASSWORD) {
      if (portalErrorText) portalErrorText.textContent = "Incorrect password.";
      portalPasswordInput.select();
      return;
    }

    sessionStorage.setItem("chobeoneBracketAccessUnlocked", "true");
    sessionStorage.setItem("chobeoneBracketAdminUnlocked", "true");

    if (pendingPortalAction === "bracketing") {
      window.location.href = "bracketing.html";
      return;
    }

    closePortalModal();
    showToast("info", "Admin Portal: Official tournament roster and management view.");
  });
}

/* ==========================================================================
   Category Dropdown & Availability
   ========================================================================== */
function updateCategoryHint() {
  const selectedVal = categorySelect.value;
  const availability = categoryAvailabilityByName.get(selectedVal);

  if (!selectedVal) {
    categoryAvailability.innerHTML = `<span class="hint-pill">${MAX_TEAMS_PER_CATEGORY} team slots max per category.</span>`;
    return;
  }

  if (!availability) {
    categoryAvailability.textContent = `${MAX_TEAMS_PER_CATEGORY} team slots per category.`;
    return;
  }

  if (availability.full) {
    categoryAvailability.innerHTML = `<span style="color: var(--red-600); font-weight: 700;">⚠ This category is fully booked (${availability.registeredTeams}/${MAX_TEAMS_PER_CATEGORY} slots).</span>`;
  } else {
    categoryAvailability.innerHTML = `<span style="color: var(--green-700); font-weight: 700;">✓ ${availability.remainingSlots} team slot(s) remaining (${availability.registeredTeams}/${MAX_TEAMS_PER_CATEGORY} filled).</span>`;
  }
}

/* Render Custom Smooth Dropdown Options */
function renderCustomDropdown() {
  if (!dropdownMenu) return;
  dropdownMenu.innerHTML = "";

  const options = Array.from(categorySelect.options);
  
  options.forEach((opt) => {
    if (!opt.value) return; // skip default placeholder

    const availability = categoryAvailabilityByName.get(opt.value);
    const isFull = Boolean(availability && availability.full);
    const isSelected = categorySelect.value === opt.value;

    const li = document.createElement("li");
    li.className = `dropdown-option${isSelected ? " selected" : ""}${isFull ? " disabled" : ""}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", isSelected ? "true" : "false");
    li.dataset.value = opt.value;

    let badgeText = "";
    if (availability) {
      badgeText = isFull ? "Full" : `${availability.remainingSlots} slots left`;
    } else {
      badgeText = "16 slots";
    }

    li.innerHTML = `
      <span class="option-name">${escapeHtml(opt.dataset.baseLabel || getCategoryDisplayName(opt.value))}</span>
      <span class="option-badge">${badgeText}</span>
    `;

    li.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isFull) {
        showToast("error", `"${opt.value}" is fully booked. Please choose another category.`);
        return;
      }
      selectCategoryOption(opt.value);
      closeCustomDropdown();
    });

    dropdownMenu.appendChild(li);
  });

  // Update selected display text
  if (categorySelect.value) {
    dropdownSelectedText.textContent = getCategoryDisplayName(categorySelect.value);
    dropdownSelectedText.classList.remove("is-placeholder");
  } else {
    dropdownSelectedText.textContent = "Select category bracket";
    dropdownSelectedText.classList.add("is-placeholder");
  }
}

function selectCategoryOption(value) {
  categorySelect.value = value;
  categorySelect.dispatchEvent(new Event("change", { bubbles: true }));

  if (value) {
    dropdownSelectedText.textContent = getCategoryDisplayName(value);
    dropdownSelectedText.classList.remove("is-placeholder");
  } else {
    dropdownSelectedText.textContent = "Select category bracket";
    dropdownSelectedText.classList.add("is-placeholder");
  }

  // Update selected class in dropdown
  Array.from(dropdownMenu.children).forEach((child) => {
    const matches = child.dataset.value === value;
    child.classList.toggle("selected", matches);
    child.setAttribute("aria-selected", matches ? "true" : "false");
  });

  // Highlight bracket card in bottom grid if present
  highlightBracketCard(value);
}

function openCustomDropdown() {
  customDropdown.classList.add("open");
  customDropdown.setAttribute("aria-expanded", "true");
}

function closeCustomDropdown() {
  customDropdown.classList.remove("open");
  customDropdown.setAttribute("aria-expanded", "false");
}

function toggleCustomDropdown() {
  if (customDropdown.classList.contains("open")) {
    closeCustomDropdown();
  } else {
    openCustomDropdown();
  }
}

dropdownTrigger.addEventListener("click", (e) => {
  e.preventDefault();
  toggleCustomDropdown();
});

// Close dropdown when clicking outside
document.addEventListener("click", (event) => {
  if (!customDropdown.contains(event.target)) {
    closeCustomDropdown();
  }
});

// Keyboard navigation for dropdown
customDropdown.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCustomDropdown();
  } else if (e.key === "Enter" || e.key === " ") {
    if (!customDropdown.classList.contains("open")) {
      e.preventDefault();
      openCustomDropdown();
    }
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!customDropdown.classList.contains("open")) {
      openCustomDropdown();
      return;
    }
    const items = Array.from(dropdownMenu.querySelectorAll(".dropdown-option:not(.disabled)"));
    if (items.length === 0) return;
    const currentIndex = items.findIndex(item => item.classList.contains("highlighted"));
    let nextIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= items.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = items.length - 1;

    items.forEach(i => i.classList.remove("highlighted"));
    items[nextIndex].classList.add("highlighted");
    items[nextIndex].scrollIntoView({ block: "nearest" });
  }
});

/* ==========================================================================
   Category Bracket Cards in Bottom Overview
   ========================================================================== */
function getBracketBadge(categoryName) {
  if (categoryName.includes("Men's")) return "Men's Doubles";
  if (categoryName.includes("Women's")) return "Women's Doubles";
  if (categoryName.includes("Mixed")) return "Mixed Doubles";
  return "Open Doubles";
}

function renderBracketCards(categories) {
  if (!categoryGrid) return;
  categoryGrid.innerHTML = "";

  categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = `bracket-card${cat.full ? " is-full" : ""}${categorySelect.value === cat.name ? " is-selected" : ""}`;
    card.dataset.categoryName = cat.name;

    const badgeLabel = getBracketBadge(cat.name);
    const slotsText = cat.full ? "Bracket Full" : `${cat.remainingSlots} slots left`;

    card.innerHTML = `
      <div>
        <div class="bracket-badge">${badgeLabel}</div>
        <h3 class="bracket-title">${escapeHtml(getCategoryDisplayName(cat.name))}</h3>
      </div>
      <div class="bracket-footer">
        <span class="bracket-slots${cat.full ? " full" : ""}">${slotsText}</span>
        <span class="bracket-select-action">
          ${cat.full ? "Full" : "Select &rarr;"}
        </span>
      </div>
    `;

    card.addEventListener("click", () => {
      if (cat.full) {
        showToast("error", `"${cat.name}" is already full.`);
        return;
      }
      selectCategoryOption(cat.name);
      showToast("info", `Selected: ${cat.name}`);
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    categoryGrid.appendChild(card);
  });
}

function highlightBracketCard(selectedCategory) {
  if (!categoryGrid) return;
  const cards = categoryGrid.querySelectorAll(".bracket-card");
  cards.forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.categoryName === selectedCategory);
  });
}

/* ==========================================================================
   Sync Availability with Backend
   ========================================================================== */
function applyCategoryAvailability(categories) {
  categoryAvailabilityByName.clear();
  const normalizedCategories = categories.map(normalizeCategory);
  normalizedCategories.forEach((category) => categoryAvailabilityByName.set(category.name, category));

  Array.from(categorySelect.options).forEach((option) => {
    if (!option.value) return;

    const baseLabel = option.dataset.baseLabel || getCategoryDisplayName(option.value);
    const availability = categoryAvailabilityByName.get(option.value);
    const slotCount = availability ? `${availability.registeredTeams}/${MAX_TEAMS_PER_CATEGORY} slots` : "";
    option.dataset.baseLabel = baseLabel;
    option.disabled = Boolean(availability && availability.full);
    option.textContent = option.disabled
      ? `${baseLabel} - ${slotCount} - Full`
      : `${baseLabel} - ${slotCount}`;
  });

  if (categorySelect.selectedOptions[0] && categorySelect.selectedOptions[0].disabled) {
    selectCategoryOption("");
  }

  updateCategoryHint();
  renderCustomDropdown();
  renderBracketCards(normalizedCategories);
}

async function loadCategoryAvailability() {
  const renderFallbackCards = () => {
    const fallbackCategories = Array.from(categorySelect.options)
      .filter((opt) => opt.value)
      .map((opt) => ({
        name: opt.value,
        registeredTeams: 0,
        remainingSlots: MAX_TEAMS_PER_CATEGORY,
        full: false
      }));
    renderBracketCards(fallbackCategories);
  };

  if (!GOOGLE_SCRIPT_URL) {
    categoryAvailability.textContent = "Google Script URL not configured.";
    renderCustomDropdown();
    renderFallbackCards();
    return;
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const result = await response.json();

    if (result.ok && Array.isArray(result.categories)) {
      applyCategoryAvailability(result.categories);
      if (result.teamsByCategory) {
        existingTeamsByCategory = result.teamsByCategory;
      }
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    categoryAvailability.textContent = "16 team slots per category.";
    renderCustomDropdown();
    renderFallbackCards();
  }
}

/* ==========================================================================
   Custom File Input Handlers (Feedback & Previews)
   ========================================================================== */
function setupDropzoneFeedback(inputElem, dropzoneElem, tagElem, defaultPrompt) {
  if (!inputElem || !dropzoneElem) return;

  inputElem.addEventListener("change", () => {
    const file = inputElem.files[0];
    const promptElem = dropzoneElem.querySelector(".dropzone-prompt");
    const subElem = dropzoneElem.querySelector(".dropzone-sub");

    if (file) {
      dropzoneElem.classList.add("has-file");
      if (promptElem) {
        promptElem.textContent = file.name;
      }
      if (subElem) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        subElem.textContent = `${sizeMb} MB &bull; Ready to upload`;
      }
      if (tagElem) {
        tagElem.hidden = false;
        tagElem.textContent = "✓ Photo Ready";
      }
    } else {
      dropzoneElem.classList.remove("has-file");
      if (promptElem) promptElem.textContent = defaultPrompt;
      if (subElem) subElem.textContent = "Click to browse or take photo (JPG, PNG)";
      if (tagElem) tagElem.hidden = true;
    }
  });
}

setupDropzoneFeedback(playerOnePhotoInput, dropzonePlayerOne, tagPlayerOne, "Upload Player 1 Photo");
setupDropzoneFeedback(playerTwoPhotoInput, dropzonePlayerTwo, tagPlayerTwo, "Upload Player 2 Photo");

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const photo = new Image();
    const photoUrl = URL.createObjectURL(file);
    photo.onload = () => {
      try {
        const scale = Math.min(1, 1280 / Math.max(photo.naturalWidth, photo.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(photo, 0, 0, canvas.width, canvas.height);
        resolve({
          name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
          type: "image/jpeg",
          data: canvas.toDataURL("image/jpeg", 0.8).split(",")[1]
        });
      } catch (error) {
        reject(new Error("Unable to prepare selected photo. Please choose a smaller JPG or PNG."));
      } finally {
        URL.revokeObjectURL(photoUrl);
      }
    };
    photo.onerror = () => {
      URL.revokeObjectURL(photoUrl);
      reject(new Error("Unable to read selected photo. Please choose a JPG or PNG."));
    };
    photo.src = photoUrl;
  });
}

categorySelect.addEventListener("change", () => {
  updateCategoryHint();
  if (categorySelect.value) {
    dropdownSelectedText.textContent = getCategoryDisplayName(categorySelect.value);
    dropdownSelectedText.classList.remove("is-placeholder");
  } else {
    dropdownSelectedText.textContent = "Select category bracket";
    dropdownSelectedText.classList.add("is-placeholder");
  }
  highlightBracketCard(categorySelect.value);
});

/* ==========================================================================
   Form Submission Flow
   ========================================================================== */
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;

  if (!form.checkValidity()) {
    form.reportValidity();
    showToast("error", "Please complete all required fields marked with *.");
    return;
  }

  if (!GOOGLE_SCRIPT_URL) {
    showToast("error", "Google Apps Script URL is not set yet. Please check script.js.");
    return;
  }

  const selectedCategory = categorySelect.value;
  if (!selectedCategory) {
    showToast("error", "Please select a category bracket.");
    customDropdown.focus();
    return;
  }

  const selectedAvailability = categoryAvailabilityByName.get(selectedCategory);
  if (selectedAvailability && selectedAvailability.full) {
    showToast("error", "This category is already full. Please select another bracket.");
    return;
  }

  const teamNameInput = form.querySelector('[name="teamName"]')?.value?.trim() || "";
  const p1Input = form.querySelector('[name="playerOne"]')?.value?.trim() || "";
  const p2Input = form.querySelector('[name="playerTwo"]')?.value?.trim() || "";

  const p1Norm = normalizePlayerName(p1Input);
  const p2Norm = normalizePlayerName(p2Input);
  const teamNameNorm = teamNameInput.toLowerCase().replace(/\s+/g, " ");
  const playerIds = ["playerOneId", "playerTwoId"].map((name) =>
    form.elements[name].value.trim().toLowerCase().replace(/\s+/g, " ")
  );

  if (playerIds[0] && playerIds[0] === playerIds[1]) {
    showToast("error", "Player 1 and Player 2 cannot use the same ID No.");
    return;
  }

  // Deduplication Rule 1: Player 1 and Player 2 cannot be identical
  if (p1Norm && p1Norm === p2Norm) {
    showToast("error", "Player 1 and Player 2 cannot be the same person.");
    return;
  }

  // Deduplication Rule 2 & 3: Check if either player is already registered in existing teams
  let playerConflictMsg = null;
  let teamNameConflictMsg = null;

  Object.entries(existingTeamsByCategory).forEach(([catName, teamList]) => {
    if (!Array.isArray(teamList)) return;
    teamList.forEach((existingTeam) => {
      const exP1Norm = normalizePlayerName(existingTeam.playerOne);
      const exP2Norm = normalizePlayerName(existingTeam.playerTwo);
      const exTeamNorm = (existingTeam.teamName || "").trim().toLowerCase().replace(/\s+/g, " ");

      if (!playerConflictMsg) {
        if (p1Norm && (p1Norm === exP1Norm || p1Norm === exP2Norm)) {
          playerConflictMsg = `"${p1Input}" is already registered in "${existingTeam.teamName}" (${catName}). Each player can only join 1 team & category.`;
        } else if (p2Norm && (p2Norm === exP1Norm || p2Norm === exP2Norm)) {
          playerConflictMsg = `"${p2Input}" is already registered in "${existingTeam.teamName}" (${catName}). Each player can only join 1 team & category.`;
        }
      }

      if (!teamNameConflictMsg && teamNameNorm && teamNameNorm === exTeamNorm) {
        teamNameConflictMsg = `Team name "${teamNameInput}" is already registered in ${catName}.`;
      }
    });
  });

  if (playerConflictMsg) {
    showToast("error", playerConflictMsg, 5000);
    return;
  }

  if (teamNameConflictMsg) {
    showToast("error", teamNameConflictMsg, 5000);
    return;
  }

  setLoading(true);

  try {
    const payload = new FormData(form);
    const playerOnePhoto = await fileToPayload(playerOnePhotoInput.files[0]);
    const playerTwoPhoto = await fileToPayload(playerTwoPhotoInput.files[0]);

    payload.delete("playerOnePhoto");
    payload.delete("playerTwoPhoto");
    payload.append("submittedAt", new Date().toISOString());
    payload.append("eventName", "Cho-Be-One Mini Pickleball Tournament");

    if (playerOnePhoto) {
      payload.append("playerOnePhotoName", playerOnePhoto.name);
      payload.append("playerOnePhotoType", playerOnePhoto.type);
      payload.append("playerOnePhotoData", playerOnePhoto.data);
    }

    if (playerTwoPhoto) {
      payload.append("playerTwoPhotoName", playerTwoPhoto.name);
      payload.append("playerTwoPhotoType", playerTwoPhoto.type);
      payload.append("playerTwoPhotoData", playerTwoPhoto.data);
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: payload
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The server did not confirm registration. Check Official Teams before retrying. Your form has been kept.");
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Registration failed.");
    }

    form.reset();

    // Reset custom dropzone labels
    if (dropzonePlayerOne) {
      dropzonePlayerOne.classList.remove("has-file");
      dropzonePlayerOne.querySelector(".dropzone-prompt").textContent = "Upload Player 1 Photo";
      dropzonePlayerOne.querySelector(".dropzone-sub").textContent = "Click to browse or take photo (JPG, PNG)";
      if (tagPlayerOne) tagPlayerOne.hidden = true;
    }
    if (dropzonePlayerTwo) {
      dropzonePlayerTwo.classList.remove("has-file");
      dropzonePlayerTwo.querySelector(".dropzone-prompt").textContent = "Upload Player 2 Photo";
      dropzonePlayerTwo.querySelector(".dropzone-sub").textContent = "Click to browse or take photo (JPG, PNG)";
      if (tagPlayerTwo) tagPlayerTwo.hidden = true;
    }

    selectCategoryOption("");

    if (Array.isArray(result.categories)) {
      applyCategoryAvailability(result.categories);
    } else {
      loadCategoryAvailability();
    }

    showToast("success", "Registration submitted successfully! See you on the court.");
    openSuccessModal();
  } catch (error) {
    const message = error instanceof TypeError
      ? "Connection interrupted. Check Official Teams before retrying; your registration may already be saved. Your form has been kept."
      : error.message || "Unable to submit registration right now. Please try again.";
    showToast("error", message, 8000);
  } finally {
    setLoading(false);
  }
});

/* Initialize */
renderCustomDropdown();
loadCategoryAvailability();

/* Secondary Action Button Handlers */
const adminPortalBtn = document.querySelector("#adminPortalBtn");
const bracketingPortalBtn = document.querySelector("#bracketingPortalBtn");
const officialTeamsBtn = document.querySelector("#officialTeamsBtn");

if (adminPortalBtn) {
  adminPortalBtn.addEventListener("click", () => {
    openPortalAccessModal("admin");
  });
}

if (bracketingPortalBtn) {
  bracketingPortalBtn.addEventListener("click", () => {
    openPortalAccessModal("bracketing");
  });
}

if (officialTeamsBtn) {
  officialTeamsBtn.addEventListener("click", () => {
    window.location.href = "official-teams.html";
  });
}
