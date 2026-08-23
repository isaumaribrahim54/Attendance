// dashboard.js
// Builds the summary stat cards and the Top 50 attendance ranking table.
//
// Ranking rule: percentage = classes attended / total CLOSED sessions.
// Sessions that haven't closed yet are excluded from the denominator so a
// student isn't penalised for a practical that hasn't finished.
//
// Sort order: highest attendance percentage first.
// Tie-break rule (stated explicitly so it's predictable, not arbitrary):
//   1) more classes attended wins, then
//   2) full name, alphabetically (A→Z).

import { db } from "./firebase-config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";

const statTotalStudents = document.getElementById("stat-total-students");
const statTotalSessions = document.getElementById("stat-total-sessions");
const statOpenSessions = document.getElementById("stat-open-sessions");
const statTotalRecords = document.getElementById("stat-total-records");
const statPresentToday = document.getElementById("stat-present-today");
const statAbsentToday = document.getElementById("stat-absent-today");
const rankingBody = document.getElementById("ranking-body");
const rankingEmpty = document.getElementById("ranking-empty");

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

document.addEventListener("auth-ready", loadDashboard);

async function loadDashboard() {
  try {
    const [usersSnap, sessionsSnap, attendanceSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "student"))),
      getDocs(collection(db, "sessions")),
      getDocs(collection(db, "attendance"))
    ]);

    const students = usersSnap.docs.map((d) => d.data());
    const sessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const attendanceRecords = attendanceSnap.docs.map((d) => d.data());

    const now = new Date();
    const toDate = (ts) => (ts?.toDate ? ts.toDate() : new Date(ts));

    const openSessions = sessions.filter((s) => now >= toDate(s.openDateTime) && now <= toDate(s.closeDateTime));
    const closedSessions = sessions.filter((s) => now > toDate(s.closeDateTime));

    const presentToday = attendanceRecords.filter((r) => r.timestamp && isSameDay(toDate(r.timestamp), now));

    const todaysClosedSessions = closedSessions.filter((s) => isSameDay(toDate(s.openDateTime), now));
    const absentToday = todaysClosedSessions.length > 0
      ? Math.max(students.length * todaysClosedSessions.length - presentToday.length, 0)
      : 0;

    statTotalStudents.textContent = students.length;
    statTotalSessions.textContent = sessions.length;
    statOpenSessions.textContent = openSessions.length;
    statTotalRecords.textContent = attendanceRecords.length;
    statPresentToday.textContent = presentToday.length;
    statAbsentToday.textContent = absentToday;

    renderRanking(students, attendanceRecords, closedSessions.length);
  } catch (err) {
    console.error("Failed to load dashboard:", err);
  }
}

function renderRanking(students, attendanceRecords, totalClosedSessions) {
  rankingBody.innerHTML = "";

  if (students.length === 0 || totalClosedSessions === 0) {
    rankingEmpty.hidden = false;
    return;
  }
  rankingEmpty.hidden = true;

  const ranked = students.map((student) => {
    const attended = attendanceRecords.filter((r) => r.uid === student.uid).length;
    const absent = Math.max(totalClosedSessions - attended, 0);
    const percentage = totalClosedSessions > 0 ? (attended / totalClosedSessions) * 100 : 0;
    return { ...student, attended, absent, percentage };
  });

  ranked.sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    if (b.attended !== a.attended) return b.attended - a.attended;
    return a.fullName.localeCompare(b.fullName);
  });

  ranked.slice(0, 50).forEach((student, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(student.fullName)}</td>
      <td>${escapeHtml(student.registrationNumber)}</td>
      <td>${escapeHtml(student.department)}</td>
      <td>${student.attended}</td>
      <td>${student.absent}</td>
      <td>${student.percentage.toFixed(1)}%</td>
    `;
    rankingBody.appendChild(row);
  });
}
