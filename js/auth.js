// auth.js
// Loaded on every page. Handles three jobs:
//   1. Reacts to Firebase Auth state and updates the shared nav bar.
//   2. Enforces page protection using <body data-protected="auth|admin">.
//   3. Wires up the Logout button.
//
// IMPORTANT: This client-side redirect is a UX convenience only. The real
// authorization boundary is enforced in Firestore Security Rules, because a
// user could always disable JavaScript or edit the page — see firestore.rules.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const protection = document.body.dataset.protected || "none"; // "none" | "auth" | "admin"
const guestOnly = document.body.dataset.guestOnly === "true"; // login/register pages

// TEMPORARY WORKAROUND: while the Firestore registration write is being
// debugged, this specific email is treated as admin regardless of what (or
// whether) a Firestore profile document exists for it. This is NOT a
// permanent security model — it only affects what THIS BROWSER shows/allows
// on the client side. Firestore Security Rules still require a real
// `role: "admin"` document to actually write to admin-only collections, so
// this account will be able to SEE the admin panel but some admin actions
// (creating sessions, posting announcements) will still be rejected by the
// database until the Firestore document itself has role: "admin".
const HARDCODED_ADMIN_EMAILS = ["isaumaribrahim54@gmail.com"];

// Mobile hamburger toggle for the shared nav.
const navToggle = document.getElementById("nav-toggle");
const navLinks = document.getElementById("nav-links");
navToggle?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

/** Fetch the signed-in user's Firestore profile (contains role). */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

function redirectTo(page) {
  if (!window.location.pathname.endsWith(page)) {
    window.location.href = page;
  }
}

function updateNavForGuest() {
  document.querySelectorAll("[data-nav='auth-only']").forEach((el) => (el.hidden = true));
  document.querySelectorAll("[data-nav='admin-only']").forEach((el) => (el.hidden = true));
  document.querySelectorAll("[data-nav='guest-only']").forEach((el) => (el.hidden = false));
  const nameSlot = document.querySelector("[data-nav='user-name']");
  if (nameSlot) nameSlot.textContent = "";
}

function updateNavForUser(user, profile) {
  document.querySelectorAll("[data-nav='auth-only']").forEach((el) => (el.hidden = false));
  document.querySelectorAll("[data-nav='guest-only']").forEach((el) => (el.hidden = true));
  const isAdmin = profile?.role === "admin" || HARDCODED_ADMIN_EMAILS.includes(user.email);
  document.querySelectorAll("[data-nav='admin-only']").forEach((el) => {
    el.hidden = !isAdmin;
  });
  const nameSlot = document.querySelector("[data-nav='user-name']");
  if (nameSlot) nameSlot.textContent = profile?.fullName || user.email || "";
}

const logoutButtons = document.querySelectorAll("[data-action='logout']");
logoutButtons.forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    updateNavForGuest();
    if (protection === "auth" || protection === "admin") {
      redirectTo("login.html");
    }
    return;
  }

  // Signed in.
  if (guestOnly) {
    redirectTo("index.html");
    return;
  }

  let profile = null;
  try {
    profile = await getUserProfile(user.uid);
  } catch (err) {
    console.error("Failed to load user profile:", err);
  }

  updateNavForUser(user, profile);

  const isAdmin = profile?.role === "admin" || HARDCODED_ADMIN_EMAILS.includes(user.email);
  if (protection === "admin" && !isAdmin) {
    redirectTo("index.html");
    return;
  }

  // Let pages react to the confirmed user + profile if they need to.
  document.dispatchEvent(
    new CustomEvent("auth-ready", { detail: { user, profile } })
  );
});
