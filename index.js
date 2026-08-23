// index.js
// Home page: renders the News & Updates feed for everyone, and reveals
// create/edit/delete controls only when the signed-in user is an admin.
// Firestore Security Rules are the real enforcement layer — this file only
// controls what the admin *sees*, not what Firestore will *accept*.
//
// Note: the optional announcement image is supplied as a URL (e.g. a link
// to an already-hosted image) rather than a file upload. Firebase Storage
// isn't used in this build, since Cloud Storage now requires the Blaze
// pricing plan even for small projects.

import { auth, db } from "./firebase-config.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { escapeHtml, formatDateTime, showMessage, clearMessage, setButtonLoading } from "./utils.js";

const feed = document.getElementById("announcements-feed");
const emptyState = document.getElementById("announcements-empty");
const adminPanel = document.getElementById("announcement-admin-panel");
const form = document.getElementById("announcement-form");
const messageBox = document.getElementById("announcement-message");
const submitBtn = document.getElementById("announcement-submit");
const cancelEditBtn = document.getElementById("announcement-cancel-edit");
const formTitle = document.getElementById("announcement-form-title");

let currentUser = null;
let isAdmin = false;
let editingId = null;

document.addEventListener("auth-ready", (e) => {
  currentUser = e.detail.user;
  isAdmin = e.detail.profile?.role === "admin";
  adminPanel.hidden = !isAdmin;
});

function resetForm() {
  form.reset();
  editingId = null;
  formTitle.textContent = "Post an announcement";
  submitBtn.textContent = "Publish";
  cancelEditBtn.hidden = true;
}

cancelEditBtn?.addEventListener("click", resetForm);

function announcementCard(id, data) {
  const li = document.createElement("li");
  li.className = "announcement-card";
  li.innerHTML = `
    <div class="announcement-card__header">
      <h3 class="announcement-card__title">${escapeHtml(data.title)}</h3>
      <time class="announcement-card__date">${formatDateTime(data.createdAt)}</time>
    </div>
    <p class="announcement-card__body">${escapeHtml(data.description)}</p>
    ${data.imageUrl ? `<img class="announcement-card__image" src="${data.imageUrl}" alt="Announcement attachment">` : ""}
    <div class="announcement-card__footer">
      <span class="announcement-card__author">Posted by ${escapeHtml(data.author)}</span>
      ${isAdmin ? `
        <span class="announcement-card__actions">
          <button type="button" class="btn btn--link" data-edit="${id}">Edit</button>
          <button type="button" class="btn btn--link btn--danger" data-delete="${id}">Delete</button>
        </span>` : ""}
    </div>
  `;
  return li;
}

function renderAnnouncements(snapshot) {
  feed.innerHTML = "";
  if (snapshot.empty) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  snapshot.forEach((docSnap) => {
    feed.appendChild(announcementCard(docSnap.id, docSnap.data()));
  });

  if (isAdmin) {
    feed.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => startEdit(btn.dataset.edit, snapshot));
    });
    feed.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => handleDelete(btn.dataset.delete));
    });
  }
}

const announcementsQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
onSnapshot(announcementsQuery, renderAnnouncements, (err) => {
  console.error("Failed to load announcements:", err);
});

function startEdit(id, snapshot) {
  const target = snapshot.docs.find((d) => d.id === id);
  if (!target) return;
  const data = target.data();

  editingId = id;
  form.title.value = data.title;
  form.description.value = data.description;
  form.imageUrl.value = data.imageUrl || "";
  formTitle.textContent = "Edit announcement";
  submitBtn.textContent = "Save changes";
  cancelEditBtn.hidden = false;
  window.scrollTo({ top: adminPanel.offsetTop - 20, behavior: "smooth" });
}

async function handleDelete(id) {
  if (!confirm("Delete this announcement? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "announcements", id));
  } catch (err) {
    console.error("Failed to delete announcement:", err);
    alert("Could not delete announcement. " + (err.message || ""));
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage(messageBox);

  const title = form.title.value.trim();
  const description = form.description.value.trim();
  const imageUrl = form.imageUrl.value.trim();

  if (!title || !description) {
    showMessage(messageBox, "Title and description are required.", "error");
    return;
  }

  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    showMessage(messageBox, "Image URL must start with http:// or https://", "error");
    return;
  }

  setButtonLoading(submitBtn, true, "Publishing…");

  try {
    if (editingId) {
      await updateDoc(doc(db, "announcements", editingId), {
        title,
        description,
        imageUrl: imageUrl || null,
        updatedAt: serverTimestamp()
      });
      showMessage(messageBox, "Announcement updated.", "success");
    } else {
      await addDoc(collection(db, "announcements"), {
        title,
        description,
        imageUrl: imageUrl || null,
        author: currentUser?.displayName || currentUser?.email || "Administrator",
        authorUid: currentUser?.uid || null,
        createdAt: serverTimestamp()
      });
      showMessage(messageBox, "Announcement published.", "success");
    }

    resetForm();
  } catch (err) {
    console.error("Failed to save announcement:", err);
    showMessage(messageBox, "Could not save announcement. " + (err.message || ""), "error");
  } finally {
    setButtonLoading(submitBtn, false);
  }
});
