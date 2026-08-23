// utils.js
// Shared constants and small helper functions used by multiple pages.
// No Firebase calls live here — this file is pure helpers so it can be
// imported anywhere without side effects.

export const DEPARTMENTS = [
  "Computer Science",
  "Science Laboratory Technology",
  "Pharmaceutical Technology",
  "Statistics",
  "Environmental Science"
];

// Registration number must look like: SST/NDCOMS/2025/0001
export const REG_NUMBER_REGEX = /^SST\/NDCOMS\/2025\/\d{4}$/;

/**
 * Display an inline status message inside a container element.
 * type: "error" | "success" | "info"
 */
export function showMessage(container, message, type = "error") {
  if (!container) return;
  container.textContent = message;
  container.className = `form-message form-message--${type}`;
  container.hidden = false;
}

export function clearMessage(container) {
  if (!container) return;
  container.textContent = "";
  container.hidden = true;
}

/**
 * Basic HTML-escaping for any user-supplied text we render with innerHTML.
 * Prevents stored data from being interpreted as markup.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Format a Firestore Timestamp (or Date) into a readable date string, e.g. 25 Aug 2026 */
export function formatDate(input) {
  const date = input?.toDate ? input.toDate() : new Date(input);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/** Format a Firestore Timestamp (or Date) into a readable time string, e.g. 10:05 AM */
export function formatTime(input) {
  const date = input?.toDate ? input.toDate() : new Date(input);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Format a Firestore Timestamp (or Date) into date + time, e.g. 25 Aug 2026, 10:05 AM */
export function formatDateTime(input) {
  return `${formatDate(input)}, ${formatTime(input)}`;
}

/**
 * Combine a "YYYY-MM-DD" date string with an "HH:MM" time string into a
 * real JS Date object in the browser's local timezone.
 */
export function combineDateAndTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** Simple debounce for search inputs. */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Disable a button and swap its label while an async action runs. */
export function setButtonLoading(button, isLoading, loadingText = "Please wait…") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

/** Map common Firebase Auth error codes to plain-language messages. */
export function friendlyAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password is too weak. Use at least 8 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/user-disabled": "This account has been disabled. Contact an administrator."
  };
  return map[code] || error?.message || "Something went wrong. Please try again.";
}
