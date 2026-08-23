// attendance.js
// Student-facing attendance page.
//
// Duplicate prevention strategy: each attendance record uses a deterministic
// document ID of `${sessionId}_${uid}`. That means a given student can only
// ever have ONE attendance document per session — a second attempt targets
// the exact same document ID, which Firestore Security Rules refuse to
// overwrite (see the `!exists()` check in firestore.rules). The client-side
// existence check below exists purely to give a fast, friendly message
// before even trying the write.
//
// Time-window enforcement: the client compares the session's open/close
// Timestamps against the browser clock ONLY to decide what to show. The
// write itself is only accepted by Firestore if `request.time` (the
// server's clock) falls inside the window — see firestore.rules. A student
// with a manipulated device clock cannot bypass this.

import { auth, db } from "./firebase-config.js";
import {
  collection, doc, getDoc, setDoc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { escapeHtml, formatDate, formatTime, formatDateTime } from "./utils.js";

const list = document.getElementById("sessions-list");
const emptyState = document.getElementById("sessions-empty");

let currentUser = null;
let currentProfile = null;
let sessionsCache = [];

document.addEventListener("auth-ready", (e) => {
  currentUser = e.detail.user;
  currentProfile = e.detail.profile;
  renderSessions();
});

const sessionsQuery = query(collection(db, "sessions"), orderBy("openDateTime", "desc"));
onSnapshot(sessionsQuery, (snapshot) => {
  sessionsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderSessions();
}, (err) => console.error("Failed to load sessions:", err));

function getSessionState(session) {
  const now = new Date();
  const open = session.openDateTime?.toDate ? session.openDateTime.toDate() : new Date(session.openDateTime);
  const close = session.closeDateTime?.toDate ? session.closeDateTime.toDate() : new Date(session.closeDateTime);

  if (now < open) return { state: "before", label: "Attendance not yet open" };
  if (now > close) return { state: "after", label: "Attendance closed" };
  return { state: "during", label: "Attendance open" };
}

async function renderSessions() {
  if (!currentUser) return;
  list.innerHTML = "";

  if (sessionsCache.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const session of sessionsCache) {
    const { state, label } = getSessionState(session);
    const attendanceId = `${session.id}_${currentUser.uid}`;
    const attendanceSnap = await getDoc(doc(db, "attendance", attendanceId));
    const alreadyPresent = attendanceSnap.exists();

    const card = document.createElement("li");
    card.className = "session-card";
    card.innerHTML = `
      <div class="session-card__header">
        <span class="stamp stamp--${alreadyPresent ? "present" : state}">
          ${alreadyPresent ? "PRESENT" : label.toUpperCase()}
        </span>
      </div>
      <dl class="session-card__details">
        <div><dt>Course code</dt><dd>${escapeHtml(session.courseCode)}</dd></div>
        <div><dt>Course title</dt><dd>${escapeHtml(session.courseTitle)}</dd></div>
        <div><dt>Date</dt><dd>${formatDate(session.openDateTime)}</dd></div>
        <div><dt>Opening time</dt><dd>${formatTime(session.openDateTime)}</dd></div>
        <div><dt>Closing time</dt><dd>${formatTime(session.closeDateTime)}</dd></div>
      </dl>
      <div class="session-card__action">
        <button type="button" class="btn btn--primary" data-session="${session.id}" ${alreadyPresent || state !== "during" ? "disabled" : ""}>
          PRESENT
        </button>
        <p class="session-card__note" data-note="${session.id}" role="status"></p>
      </div>
    `;
    list.appendChild(card);
  }

  list.querySelectorAll("[data-session]").forEach((btn) => {
    btn.addEventListener("click", () => markPresent(btn.dataset.session, btn));
  });
}

async function markPresent(sessionId, button) {
  const note = list.querySelector(`[data-note="${sessionId}"]`);
  note.textContent = "";

  // 1. Verify authentication.
  if (!currentUser) {
    note.textContent = "You must be signed in to record attendance.";
    return;
  }

  // 2. Verify that the student profile exists.
  if (!currentProfile) {
    note.textContent = "Your student profile could not be found. Contact an administrator.";
    return;
  }

  const session = sessionsCache.find((s) => s.id === sessionId);
  if (!session) {
    note.textContent = "This session no longer exists.";
    return;
  }

  // 3. Verify that the attendance session is open (client-side pre-check for UX).
  const { state } = getSessionState(session);
  if (state === "before") {
    note.textContent = "Attendance is not yet open.";
    return;
  }
  if (state === "after") {
    note.textContent = "Attendance is closed.";
    return;
  }

  const attendanceId = `${sessionId}_${currentUser.uid}`;
  const attendanceRef = doc(db, "attendance", attendanceId);

  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Recording…";

  try {
    // 4. Check whether the student has already attended that session.
    const existing = await getDoc(attendanceRef);
    if (existing.exists()) {
      note.textContent = "You have already recorded attendance for this practical.";
      button.textContent = "PRESENT";
      return;
    }

    // 5 & 6. Prevent duplicates and save the record.
    // setDoc on a deterministic ID + the Firestore rule's !exists() check
    // means a race condition (double-click) still cannot create two records.
    await setDoc(attendanceRef, {
      uid: currentUser.uid,
      registrationNumber: currentProfile.registrationNumber,
      firstName: currentProfile.firstName,
      surname: currentProfile.surname,
      fullName: currentProfile.fullName,
      department: currentProfile.department,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
      sessionId: sessionId,
      timestamp: serverTimestamp(),
      status: "Present"
    });

    note.textContent = "Attendance recorded successfully.";
    button.textContent = "PRESENT";
    renderSessions();
  } catch (err) {
    console.error("Failed to record attendance:", err);
    if (err.code === "permission-denied") {
      note.textContent = "Attendance is closed.";
    } else {
      note.textContent = "Could not record attendance. Please try again.";
    }
    button.disabled = false;
    button.textContent = originalLabel;
  }
}
