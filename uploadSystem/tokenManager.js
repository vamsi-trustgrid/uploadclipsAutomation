// ── tokenManager.js ───────────────────────────────────────────────────────────
// Logs in all 20 users at startup, stores tokens in memory + tokens.json
// Retries failed logins up to 3 times

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const USERS = require("./users");

const BASE_URL = "https://synq-backend.trustgrid.com";
const TOKENS_FILE = path.join(__dirname, "tokens.json");
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

// In-memory token pool: [{ username, token, userId }, ...]
let tokenPool = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Login a single user with retry
async function loginUser(user, attempt = 1) {
  try {
    console.log(`[TokenManager] Logging in: ${user.username} (attempt ${attempt}/${MAX_RETRIES})`);
    const res = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: user.username,
      password: user.password,
    });

    const { success, token, user: userData } = res.data;

    if (!success || !token) {
      throw new Error(`Login response invalid: ${JSON.stringify(res.data)}`);
    }

    console.log(`[TokenManager] ✓ Logged in: ${user.username}`);
    return {
      username: user.username,
      token,
      userId: userData.id,
    };
  } catch (err) {
    const msg = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`[TokenManager] ✗ Failed: ${user.username} — ${msg}`);

    if (attempt < MAX_RETRIES) {
      console.log(`[TokenManager] Retrying ${user.username} in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
      return loginUser(user, attempt + 1);
    }

    console.error(`[TokenManager] Giving up on ${user.username} after ${MAX_RETRIES} attempts.`);
    return null;
  }
}

// Login all users and build token pool
async function initTokens() {
  console.log(`[TokenManager] Starting login for ${USERS.length} users...`);
  tokenPool = [];

  const results = await Promise.all(USERS.map((user) => loginUser(user)));

  // Filter out failed logins
  tokenPool = results.filter(Boolean);

  console.log(`[TokenManager] ${tokenPool.length}/${USERS.length} users logged in successfully.`);

  if (tokenPool.length === 0) {
    throw new Error("[TokenManager] No users logged in. Cannot proceed.");
  }

  // Persist to tokens.json
  saveTokens();

  return tokenPool;
}

// Save token pool to disk
function saveTokens() {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokenPool, null, 2));
    console.log(`[TokenManager] Tokens saved to tokens.json`);
  } catch (err) {
    console.error(`[TokenManager] Failed to save tokens.json: ${err.message}`);
  }
}

// Get the full token pool
function getTokenPool() {
  return tokenPool;
}

// Get a single token by username
function getToken(username) {
  return tokenPool.find((t) => t.username === username) || null;
}

module.exports = {
  initTokens,
  getTokenPool,
  getToken,
  saveTokens
};