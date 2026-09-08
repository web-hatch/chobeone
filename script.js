const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzi2CP7aG4bbH9fL5ZRqwtq-O10W9zK_COYd6VNhsjCtWbJxKpBQsuMlLlxME5Sdpbl/exec";
const MAX_PLAYERS_PER_CATEGORY = 16;

/* DOM Element References */
const form = document.querySelector("#registrationForm");
const statusMessage = document.querySelector("#statusMessage");
const submitButton = form.querySelector("button[type='submit']");
const categorySelect = document.querySelector("#categorySelect");
const categoryAvailability = document.querySelector("#categoryAvailability");
const successModal = document.querySelector("#successModal");
const closeSuccessModal = document.querySelector("#closeSuccessModal");
const confirmSuccessModal = document.querySelector("#confirmSuccessModal");
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
});

/* ==========================================================================
   Category Dropdown & Availability
   ========================================================================== */
function updateCategoryHint() {
  const selectedVal = categorySelect.value;
  const availability = categoryAvailabilityByName.get(selectedVal);

  if (!selectedVal) {
    categoryAvailability.innerHTML = `<span class="hint-pill">${MAX_PLAYERS_PER_CATEGORY} players max per category.</span>`;
    return;
  }

  if (!availability) {
    categoryAvailability.textContent = `${MAX_PLAYERS_PER_CATEGORY} players per category.`;
    return;
  }

  if (availability.full) {
    categoryAvailability.innerHTML = `<span style="color: var(--red-600); font-weight: 700;">⚠ This category is fully booked (${availability.registeredPlayers}/${MAX_PLAYERS_PER_CATEGORY} players).</span>`;
  } else {
    categoryAvailability.innerHTML = `<span style="color: var(--green-700); font-weight: 700;">✓ ${availability.remainingPlayers} player slot(s) remaining (${availability.registeredPlayers}/${MAX_PLAYERS_PER_CATEGORY} filled).</span>`;
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
      badgeText = isFull ? "Full" : `${availability.remainingPlayers} slots left`;
    } else {
      badgeText = "16 slots";
    }

    li.innerHTML = `
      <span class="option-name">${escapeHtml(opt.dataset.baseLabel || opt.value)}</span>
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
    dropdownSelectedText.textContent = categorySelect.value;
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
    dropdownSelectedText.textContent = value;
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
    const slotsText = cat.full ? "Bracket Full" : `${cat.remainingPlayers} slots left`;

    card.innerHTML = `
      <div>
        <div class="bracket-badge">${badgeLabel}</div>
        <h3 class="bracket-title">${escapeHtml(cat.name)}</h3>
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
  categories.forEach((category) => categoryAvailabilityByName.set(category.name, category));

  Array.from(categorySelect.options).forEach((option) => {
    if (!option.value) return;

    const baseLabel = option.dataset.baseLabel || option.textContent.split(" - ")[0];
    const availability = categoryAvailabilityByName.get(option.value);
    const playerCount = availability ? `${availability.registeredPlayers}/${MAX_PLAYERS_PER_CATEGORY} players` : "";
    option.dataset.baseLabel = baseLabel;
    option.disabled = Boolean(availability && availability.full);
    option.textContent = option.disabled
      ? `${baseLabel} - ${playerCount} - Full`
      : `${baseLabel} - ${playerCount}`;
  });

  if (categorySelect.selectedOptions[0] && categorySelect.selectedOptions[0].disabled) {
    selectCategoryOption("");
  }

  updateCategoryHint();
  renderCustomDropdown();
  renderBracketCards(categories);
}

async function loadCategoryAvailability() {
  const renderFallbackCards = () => {
    const fallbackCategories = Array.from(categorySelect.options)
      .filter((opt) => opt.value)
      .map((opt) => ({
        name: opt.value,
        registeredPlayers: 0,
        remainingPlayers: MAX_PLAYERS_PER_CATEGORY,
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
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    categoryAvailability.textContent = "16 players per category.";
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

    const reader = new FileReader();
    reader.onload = () => {
      const [meta, base64] = String(reader.result).split(",");
      const typeMatch = meta.match(/data:(.*);base64/);
      resolve({
        name: file.name,
        type: typeMatch ? typeMatch[1] : file.type,
        data: base64
      });
    };
    reader.onerror = () => reject(new Error("Unable to read selected photo."));
    reader.readAsDataURL(file);
  });
}

categorySelect.addEventListener("change", () => {
  updateCategoryHint();
  if (categorySelect.value) {
    dropdownSelectedText.textContent = categorySelect.value;
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

  setLoading(true);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: payload
    });

    const result = await response.json();

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
    showToast("error", error.message || "Unable to submit registration right now. Please try again.");
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

if (adminPortalBtn) {
  adminPortalBtn.addEventListener("click", () => {
    showToast("info", "Admin Portal: Official tournament roster and management view.");
  });
}

if (bracketingPortalBtn) {
  bracketingPortalBtn.addEventListener("click", () => {
    showToast("info", "Navigating to Tournament Brackets overview.");
    const categoriesSection = document.querySelector(".categories-section");
    if (categoriesSection) {
      categoriesSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}
