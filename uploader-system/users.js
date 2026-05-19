// ── Users Config ──────────────────────────────────────────────────────────────
// All 20 users share the same password

const PASSWORD = "12345678";

const USERS = [
  "Priyasharma",
  "Carlos"
].map((username) => ({ username, password: PASSWORD }));

module.exports = USERS;