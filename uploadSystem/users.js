// ── Users Config ──────────────────────────────────────────────────────────────
// All 20 users share the same password

const PASSWORD = "12345678";

const USERS = [
  "Priyasharma",
  "Carlos",
  "Sarah",
  "Tanaka",
  "Marcus",
  "alexchen",
  "mayapatel",
  "jordantaylor",
  "davidkim",
  "dev_marcus",
  "jsmith",
  "mramos",
  "pparker",
  "gaearon",
  "JakeWharton",
  "getify",
  "kunalkushwaha",
  "ravikumarss",
  "shuyesh",
  "Raukman"
].map((username) => ({ username, password: PASSWORD }));

module.exports = USERS;