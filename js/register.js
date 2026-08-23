// register.js
// Handles the public student registration form.
// Every account created here is forced to role: "student" — there is no
// field, hidden input, or code path that lets this form set role: "admin".
// Firestore Security Rules also enforce this server-side (see firestore.rules)
// so the restriction holds even if this file were bypassed.

import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { DEPARTMENTS, REG_NUMBER_REGEX, showMessage, clearMessage, friendlyAuthError, setButtonLoading } from "./utils.js";

const form = document.getElementById("register-form");
const departmentSelect = document.getElementById("department");
const messageBox = document.getElementById("register-message");
const submitBtn = document.getElementById("register-submit");

// Populate department dropdown from the single source of truth in utils.js.
DEPARTMENTS.forEach((dept) => {
  const opt = document.createElement("option");
  opt.value = dept;
  opt.textContent = dept;
  departmentSelect.appendChild(opt);
});

function validate({ firstName, surname, email, password, confirmPassword, registrationNumber, department }) {
  if (!firstName || firstName.trim().length < 2) {
    return "Please enter a valid first name.";
  }
  if (!surname || surname.trim().length < 2) {
    return "Please enter a valid surname.";
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return "Please enter a valid email address.";
  }
  if (!REG_NUMBER_REGEX.test(registrationNumber.trim())) {
    return "Registration number must match the format SST/NDCOMS/2025/XXXX (e.g. SST/NDCOMS/2025/0042).";
  }
  if (!department || !DEPARTMENTS.includes(department)) {
    return "Please select your department.";
  }
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage(messageBox);

  const data = {
    firstName: form.firstName.value.trim(),
    surname: form.surname.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    confirmPassword: form.confirmPassword.value,
    registrationNumber: form.registrationNumber.value.trim().toUpperCase(),
    department: form.department.value
  };

  const validationError = validate(data);
  if (validationError) {
    showMessage(messageBox, validationError, "error");
    return;
  }

  setButtonLoading(submitBtn, true, "Creating account…");

  try {
    const fullName = `${data.firstName} ${data.surname}`;

    const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = credential.user;

    await updateProfile(user, { displayName: fullName });

    // role is hard-coded to "student" — never read from the form.
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      firstName: data.firstName,
      surname: data.surname,
      fullName,
      email: data.email,
      registrationNumber: data.registrationNumber,
      department: data.department,
      role: "student",
      createdAt: serverTimestamp()
    });

    showMessage(messageBox, "Account created successfully. Redirecting…", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);
  } catch (err) {
    console.error("Registration failed:", err);
    showMessage(messageBox, friendlyAuthError(err), "error");
    setButtonLoading(submitBtn, false);
  }
});
