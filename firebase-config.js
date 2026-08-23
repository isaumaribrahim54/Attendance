// firebase-config.js
// Central Firebase initialization. Every other JS file imports auth/db/storage from here.
//
// IMPORTANT: Replace the values below with YOUR Firebase project's config
// (Firebase Console -> Project Settings -> General -> Your apps -> SDK setup).
// This object is a public app identifier, not a secret key, so it is safe to
// ship in frontend code. Real access control happens in Firestore Security Rules.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
// Firebase Storage is not used in this build — announcement images are
// linked by URL instead, since Cloud Storage now requires the Blaze
// (pay-as-you-go) pricing plan even for small projects.

const firebaseConfig = {
  apiKey: "AIzaSyCic-rCsF9hd0No-O9Vfnn0D2kh1CluYf4",
  authDomain: "student-practical-attendance.firebaseapp.com",
  projectId: "student-practical-attendance",
  storageBucket: "student-practical-attendance.firebasestorage.app",
  messagingSenderId: "959603995246",
  appId: "1:959603995246:web:d4d8ac3dd7d37c62e8ac7f",
  measurementId: "G-F704NJ33DY"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Keep users signed in across page reloads/navigation between the multi-page app.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});
