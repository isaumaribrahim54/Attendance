# Student Practical Attendance System

A multi-page web app for recording student attendance at practical/lab sessions, built with HTML5, CSS3, vanilla JavaScript, Firebase Authentication, and Cloud Firestore.

Built by **Isa Umar Ibrahim**, Department of Computer Science, Adamawa State Polytechnic Yola.

## Structure

```
/
├── index.html          Home page + News & Updates
├── login.html          Sign in
├── register.html       Student registration
├── attendance.html     Student: mark PRESENT during an open session
├── dashboard.html      Stats + Top 50 attendance ranking
├── admin.html          Admin: create sessions, manage attendance
├── about.html          About the system
├── css/
│   ├── style.css       Global styles, nav, buttons, cards
│   ├── auth.css        Login/register pages
│   ├── dashboard.css   Dashboard stat cards + ranking table
│   └── admin.css       Admin panel layout
├── js/
│   ├── firebase-config.js   Firebase init (auth + Firestore)
│   ├── utils.js              Shared constants/helpers
│   ├── auth.js                Nav state, logout, page protection
│   ├── register.js            Registration form logic
│   ├── login.js                Login form logic
│   ├── index.js                 Home page / announcements
│   ├── attendance.js            Student attendance logic
│   ├── dashboard.js             Stats + ranking
│   └── admin.js                  Admin panel logic
├── assets/              Static assets (currently empty)
└── firestore.rules      Firestore Security Rules (paste into Firebase Console)
```

## Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Enable **Firestore Database**.
4. In `js/firebase-config.js`, the `firebaseConfig` object is already filled in with this project's values. If you fork this for a different Firebase project, replace it with your own (Project Settings → General → Your apps → SDK setup and configuration).
5. Paste the contents of `firestore.rules` into **Firestore Database → Rules** in the Firebase console, then click **Publish**.
6. Serve the folder with any static file server (e.g. `npx serve`, GitHub Pages, Firebase Hosting). It cannot be opened directly via `file://` because ES module imports require an HTTP(S) origin.

## Creating the first admin account

There is no public "sign up as admin" option — every account registered through `register.html` is created with `role: "student"` by design (both in the app code and enforced server-side in `firestore.rules`).

To create an admin:
1. Register a normal account through the app.
2. In the Firebase console, go to **Firestore Database → Data → users → (your document)**.
3. Change the `role` field from `"student"` to `"admin"`.
4. Refresh the app — the Admin Panel link will now appear in the nav, and `admin.html` will be accessible.

## Notes on Firebase Storage

Firebase now requires the paid **Blaze** plan to provision Cloud Storage, even for small projects. To avoid that requirement, this app does **not** use Firebase Storage. The optional announcement image is a plain URL field (link to an already-hosted image) instead of a file upload.

## Security model

Client-side checks (hiding nav links, redirecting pages) are UX only. The real authorization boundary is `firestore.rules`, which enforces:

- New accounts can only be created with `role: "student"` — never `admin`.
- Only admins can create/edit/delete practical sessions and announcements.
- A student can only create an attendance record for themselves, only while the session is open — checked against Firestore's own server clock (`request.time`), not the browser's.
- Each student can have at most one attendance record per session (deterministic document ID `sessionId_uid` + an existence check in the rules).
- Students can only read their own attendance records; admins can read all of them.
- Only admins can edit or delete an existing attendance record.
