// ── main.js (Token Test Only) ────────────────────────────────────────────────
// Purpose:
//   1. Login all 20 users
//   2. Store tokens in memory
//   3. Save tokens.json
//   4. Exit

const { initTokens } = require("./tokenManager");
console.log("MAIN FILE LOADED");
async function start() {
  console.log("════════════════════════════════════════");
  console.log("   Token Initialization Test Starting   ");
  console.log("════════════════════════════════════════\n");

  try {
    const tokenPool = await initTokens();

    console.log("\n════════════════════════════════════════");
    console.log("   TOKEN INITIALIZATION SUCCESS         ");
    console.log("════════════════════════════════════════");

    console.log(`\nTotal Tokens Stored: ${tokenPool.length}\n`);

    // Print a preview (first 3 users only)
    console.log("Sample Tokens:");
    tokenPool.slice(0, 3).forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.username} → ${user.token.substring(0, 20)}...`
      );
    });

    console.log("\nCheck tokens.json file for full data.\n");

    process.exit(0);

  } catch (err) {
    console.error("\n════════════════════════════════════════");
    console.error("   TOKEN INITIALIZATION FAILED ✗         ");
    console.error("════════════════════════════════════════");

    console.error("\nError:", err.message);
    process.exit(1);
  }
}

// Handle unexpected crashes safely
process.on("uncaughtException", (err) => {
  console.error("[Main] Uncaught exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Main] Unhandled rejection:", reason);
});

start();