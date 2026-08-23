// admin.js
// Admin-only page logic. Route access is already gated by
// <body data-protected="admin"> in auth.js, and every write here is also
// checked server-side by Firestore Security Rules — this file assumes the
// user is an admin but never trusts that assumption for security, only for UI.
//
// Absent students are NEVER written to Firestore. They are calculated in
// the browser, on demand, as: (all students) minus (students with a
// present record for that session). Before a session closes we label this
// list "Not yet marked present" rather than "Absent", because the window
// to attend hasn't ended yet.

import { db } from "./firebase-config.js";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  getDocs, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { escapeHtml, formatDate, formatTime, combineDateAndTime, showMessage, clearMessage, setButtonLoading, debounce } from "./utils.js";

// ---------- Session creation ----------
const sessionForm = document.getElementById("session-form");
const sessionMessage = document.getElementById("session-message");
const sessionSubmit = document.getElementById("session-submit");

sessionForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage(sessionMessage);

  const courseCode = sessionForm.courseCode.value.trim().toUpperCase();
  const courseTitle = sessionForm.courseTitle.value.trim();
  const date = sessionForm.date.value;
  const openingTime = sessionForm.openingTime.value;
  const closingTime = sessionForm.closingTime.value;

  if (!courseCode || !courseTitle || !date || !openingTime || !closingTime) {
    showMessage(sessionMessage, "All fields are required.", "error");
    return;
  }

  const openDateTime = combineDateAndTime(date, openingTime);
  const closeDateTime = combineDateAndTime(date, closingTime);

  if (closeDateTime <= openDateTime) {
    showMessage(sessionMessage, "Closing time must be after opening time.", "error");
    return;
  }

  setButtonLoading(sessionSubmit, true, "Creating…");

  try {
    await addDoc(collection(db, "sessions"), {
      courseCode,
      courseTitle,
      date,
      openingTime,
      closingTime,
      openDateTime,
      closeDateTime,
      createdAt: new Date()
    });
    showMessage(sessionMessage, "Practical session created.", "success");
    sessionForm.reset();
  } catch (err) {
    console.error("Failed to create session:", err);
    showMessage(sessionMessage, "Could not create session. " + (err.message || ""), "error");
  } finally {
    setButtonLoading(sessionSubmit, false);
  }
});

// ---------- Data cache ----------
let allStudents = [];
let allSessions = [];
let allAttendance = [];

const sessionsList = document.getElementById("admin-sessions-list");
const sessionsEmpty = document.getElementById("admin-sessions-empty");
const searchInput = document.getElementById("search-reg-number");
const courseFilter = document.getElementById("filter-course");
const dateFilter = document.getElementById("filter-date");

async function loadStudents() {
  const snap = await getDocs(collection(db, "users"));
  allStudents = snap.docs.map((d) => d.data()).filter((u) => u.role === "student");
}

function getState(session) {
  const now = new Date();
  const open = session.openDateTime?.toDate ? session.openDateTime.toDate() : new Date(session.openDateTime);
  const close = session.closeDateTime?.toDate ? session.closeDateTime.toDate() : new Date(session.closeDateTime);
  if (now < open) return "before";
  if (now > close) return "closed";
  return "open";
}

function computeSessionRows(session) {
  const present = allAttendance.filter((r) => r.sessionId === session.id);
  const presentUids = new Set(present.map((r) => r.uid));
  const notPresent = allStudents.filter((s) => !presentUids.has(s.uid));
  return { present, notPresent };
}

function matchesFilters(session) {
  if (courseFilter.value && session.courseCode !== courseFilter.value) return false;
  if (dateFilter.value && session.date !== dateFilter.value) return false;
  return true;
}

function populateCourseFilter() {
  const codes = [...new Set(allSessions.map((s) => s.courseCode))].sort();
  const current = courseFilter.value;
  courseFilter.innerHTML = '<option value="">All courses</option>' +
    codes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  courseFilter.value = codes.includes(current) ? current : "";
}

function renderSessions() {
  const search = searchInput.value.trim().toUpperCase();
  const visibleSessions = allSessions.filter(matchesFilters);

  sessionsList.innerHTML = "";

  if (visibleSessions.length === 0) {
    sessionsEmpty.hidden = false;
    return;
  }
  sessionsEmpty.hidden = true;

  visibleSessions.forEach((session) => {
    const { present, notPresent } = computeSessionRows(session);
    const state = getState(session);
    const total = allStudents.length;
    const presentCount = present.length;
    const absentCount = Math.max(total - presentCount, 0);
    const percentage = total > 0 ? ((presentCount / total) * 100).toFixed(1) : "0.0";
    const absentLabel = state === "closed" ? "Absent" : "Not yet marked present";

    let filteredPresent = present;
    let filteredNotPresent = notPresent;
    if (search) {
      filteredPresent = present.filter((r) => r.registrationNumber?.toUpperCase().includes(search));
      filteredNotPresent = notPresent.filter((s) => s.registrationNumber?.toUpperCase().includes(search));
    }

    const card = document.createElement("li");
    card.className = "admin-session-card";
    card.innerHTML = `
      <div class="admin-session-card__summary">
        <div>
          <h3>${escapeHtml(session.courseCode)} — ${escapeHtml(session.courseTitle)}</h3>
          <p class="admin-session-card__meta">${formatDate(session.openDateTime)} · ${formatTime(session.openDateTime)}–${formatTime(session.closeDateTime)} · <span class="stamp stamp--${state === "open" ? "during" : state === "before" ? "before" : "after"}">${state.toUpperCase()}</span></p>
        </div>
        <dl class="admin-session-card__stats">
          <div><dt>Registered</dt><dd>${total}</dd></div>
          <div><dt>Present</dt><dd>${presentCount}</dd></div>
          <div><dt>${absentLabel}</dt><dd>${absentCount}</dd></div>
          <div><dt>Attendance %</dt><dd>${percentage}%</dd></div>
        </dl>
      </div>

      <details class="admin-session-card__details">
        <summary>View present (${filteredPresent.length})</summary>
        <table class="data-table">
          <thead><tr><th>Reg. Number</th><th>Name</th><th>Department</th><th>Time</th><th>Actions</th></tr></thead>
          <tbody>
            ${filteredPresent.map((r) => `
              <tr>
                <td>${escapeHtml(r.registrationNumber)}</td>
                <td>${escapeHtml(r.fullName)}</td>
                <td>${escapeHtml(r.department)}</td>
                <td>${formatTime(r.timestamp)}</td>
                <td>
                  <button type="button" class="btn btn--link" data-correct="${session.id}|${r.uid}">Correct</button>
                  <button type="button" class="btn btn--link btn--danger" data-remove="${session.id}|${r.uid}">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="5">No matching records.</td></tr>`}
          </tbody>
        </table>
      </details>

      <details class="admin-session-card__details">
        <summary>View ${absentLabel.toLowerCase()} (${filteredNotPresent.length})</summary>
        <table class="data-table">
          <thead><tr><th>Reg. Number</th><th>Name</th><th>Department</th><th>Status</th></tr></thead>
          <tbody>
            ${filteredNotPresent.map((s) => `
              <tr>
                <td>${escapeHtml(s.registrationNumber)}</td>
                <td>${escapeHtml(s.fullName)}</td>
                <td>${escapeHtml(s.department)}</td>
                <td>${absentLabel}</td>
              </tr>`).join("") || `<tr><td colspan="4">No matching students.</td></tr>`}
          </tbody>
        </table>
      </details>
    `;
    sessionsList.appendChild(card);
  });

  sessionsList.querySelectorAll("[data-correct]").forEach((btn) => {
    btn.addEventListener("click", () => handleCorrect(btn.dataset.correct));
  });
  sessionsList.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => handleRemove(btn.dataset.remove));
  });
}

async function handleCorrect(key) {
  const [sessionId, uid] = key.split("|");
  const record = allAttendance.find((r) => r.sessionId === sessionId && r.uid === uid);
  if (!record) return;

  const newCourseCode = prompt("Correct course code:", record.courseCode);
  if (newCourseCode === null) return;
  const newCourseTitle = prompt("Correct course title:", record.courseTitle);
  if (newCourseTitle === null) return;

  try {
    await updateDoc(doc(db, "attendance", `${sessionId}_${uid}`), {
      courseCode: newCourseCode.trim().toUpperCase(),
      courseTitle: newCourseTitle.trim()
    });
  } catch (err) {
    console.error("Failed to correct record:", err);
    alert("Could not update record. " + (err.message || ""));
  }
}

async function handleRemove(key) {
  const [sessionId, uid] = key.split("|");
  if (!confirm("Delete this attendance record? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "attendance", `${sessionId}_${uid}`));
  } catch (err) {
    console.error("Failed to delete record:", err);
    alert("Could not delete record. " + (err.message || ""));
  }
}

searchInput?.addEventListener("input", debounce(renderSessions, 200));
courseFilter?.addEventListener("change", renderSessions);
dateFilter?.addEventListener("change", renderSessions);

document.addEventListener("auth-ready", async () => {
  await loadStudents();

  onSnapshot(query(collection(db, "sessions"), orderBy("openDateTime", "desc")), (snap) => {
    allSessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    populateCourseFilter();
    renderSessions();
  }, (err) => console.error("Failed to load sessions:", err));

  onSnapshot(collection(db, "attendance"), (snap) => {
    allAttendance = snap.docs.map((d) => d.data());
    renderSessions();
  }, (err) => console.error("Failed to load attendance:", err));
});
