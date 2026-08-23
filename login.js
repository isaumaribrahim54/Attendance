// login.js
// Handles sign-in, the show/hide password toggle, and "forgot password".
// After a successful login, the student's role is read from Firestore to
// decide whether they land on index.html (student) or admin.html (admin).

import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { showMessage, clearMessage, friendlyAuthError, setButtonLoading } from "./utils.js";

const form = document.getElementById("login-form");
const messageBox = document.getElementById("login-message");
const submitBtn = document.getElementById("login-submit");
const passwordInput = document.getElementById("password");
const toggleBtn = document.getElementById("toggle-password");
const forgotLink = document.getElementById("forgot-password");

toggleBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  toggleBtn.textContent = isHidden ? "Hide" : "Show";
  toggleBtn.setAttribute("aria-pressed", String(isHidden));
});

forgotLink.addEventListener("click", async (e) => {
  e.preventDefault();
  clearMessage(messageBox);

  const email = form.email.value.trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    showMessage(messageBox, "Enter your email address above first, then click 'Forgot password'.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage(messageBox, `Password reset link sent to ${email}. Check your inbox.`, "success");
  } catch (err) {
    console.error("Password reset failed:", err);
    showMessage(messageBox, friendlyAuthError(err), "error");
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage(messageBox);

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) {
    showMessage(messageBox, "Please enter both email and password.", "error");
    return;
  }

  setButtonLoading(submitBtn, true, "Signing in…");

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const profileSnap = await getDoc(doc(db, "users", uid));
    const role = profileSnap.exists() ? profileSnap.data().role : "student";

    window.location.href = role === "admin" ? "admin.html" : "index.html";
  } catch (err) {
    console.error("Login failed:", err);
    showMessage(messageBox, friendlyAuthError(err), "error");
    setButtonLoading(submitBtn, false);
  }
});
