// ── uploadSystem/main.js ──────────────────────────────────────────────────────
// Purpose:
//   1. Log in all 20 users and generate the token pool.
//   2. Scan instagramScraper/downloads/ for .mp4 videos.
//   3. For each video, assign a random user and upload via API.
//   4. Route successfully uploaded files to an 'uploaded/' folder,
//      and failed files (after 1 retry) to a 'failed/' folder.

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { initTokens, getTokenPool } = require("./tokenManager");

const BASE_URL = "https://synq-backend.trustgrid.com";
const DOWNLOADS_DIR = path.join(__dirname, "../instagramScraper/downloads");
const UPLOADED_DIR = path.join(DOWNLOADS_DIR, "uploaded");
const FAILED_DIR = path.join(DOWNLOADS_DIR, "failed");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Function to upload a single video file with a selected user
async function uploadVideo(filePath, user) {
  const form = new FormData();
  form.append("video", fs.createReadStream(filePath));

  console.log(`[Uploader] Uploading: ${path.basename(filePath)} as user: ${user.username}`);

  const response = await axios.post(`${BASE_URL}/api/posts`, form, {
    headers: {
      "Authorization": `Bearer ${user.token}`,
      ...form.getHeaders()
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  return response.data;
}

// Helper to move file safely
function moveFile(sourcePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, path.basename(sourcePath));
  try {
    fs.renameSync(sourcePath, destPath);
    console.log(`[File System] Relocated: ${path.basename(sourcePath)} ➔ ${path.basename(destDir)}/`);
  } catch (err) {
    // If cross-device link error or rename fails, fallback to copy + unlink
    fs.copyFileSync(sourcePath, destPath);
    fs.unlinkSync(sourcePath);
    console.log(`[File System] Relocated (fallback copy): ${path.basename(sourcePath)} ➔ ${path.basename(destDir)}/`);
  }
}

async function start() {
  console.log("════════════════════════════════════════");
  console.log("       SYNQ Automated Video Uploader     ");
  console.log("════════════════════════════════════════\n");

  try {
    // Step 1: Authenticate users and prepare the token pool
    const tokenPool = await initTokens();
    if (!tokenPool || tokenPool.length === 0) {
      throw new Error("Token pool is empty. Authentication failed.");
    }

    // Step 2: Scan the scraper downloads directory for MP4 files
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      console.log(`[Directory] Downloads directory not found at: ${DOWNLOADS_DIR}`);
      console.log("[Directory] Creating downloads directory...");
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(DOWNLOADS_DIR);
    const videoFiles = files
      .filter((file) => file.endsWith(".mp4"))
      .map((file) => path.join(DOWNLOADS_DIR, file));

    if (videoFiles.length === 0) {
      console.log("\n[Scan] ℹ No MP4 videos found in downloads folder. Nothing to upload.");
      process.exit(0);
    }

    console.log(`\n[Scan] ✓ Found ${videoFiles.length} videos to upload.`);

    // Step 3: Process and upload each video sequentially
    for (let i = 0; i < videoFiles.length; i++) {
      const filePath = videoFiles[i];
      const fileName = path.basename(filePath);

      console.log(`\n----------------------------------------`);
      console.log(`Processing video ${i + 1}/${videoFiles.length}: "${fileName}"`);
      console.log(`----------------------------------------`);

      // Pick a random user from the token pool
      const randomUserIndex = Math.floor(Math.random() * tokenPool.length);
      const selectedUser = tokenPool[randomUserIndex];

      let success = false;
      let attempt = 1;

      while (attempt <= 2) {
        try {
          if (attempt > 1) {
            console.log(`[Uploader] ⚠ Retrying upload (attempt ${attempt}/2) for "${fileName}"...`);
          } else {
            console.log(`[Uploader] Attempt 1/2 for "${fileName}"...`);
          }

          const result = await uploadVideo(filePath, selectedUser);
          console.log(`[Uploader] ✓ Success: ${JSON.stringify(result)}`);
          success = true;
          break;
        } catch (err) {
          const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
          console.error(`[Uploader] ✗ Attempt ${attempt} failed: ${errMsg}`);
          attempt++;
          if (attempt <= 2) {
            await sleep(1500); // Wait briefly before retry
          }
        }
      }

      // Step 4: Route file based on final upload status
      if (success) {
        console.log(`[Router] Routing "${fileName}" to UPLOADED folder.`);
        moveFile(filePath, UPLOADED_DIR);
      } else {
        console.error(`[Router] ✗ Failed all attempts. Routing "${fileName}" to FAILED folder.`);
        moveFile(filePath, FAILED_DIR);
      }
    }

    console.log("\n════════════════════════════════════════");
    console.log("       UPLOAD PROCESS COMPLETE 🎉       ");
    console.log("════════════════════════════════════════\n");
    process.exit(0);

  } catch (err) {
    console.error("\n════════════════════════════════════════");
    console.error("         UPLOADER CRITICAL FAILURE ✗     ");
    console.error("════════════════════════════════════════");
    console.error("\nFatal Error:", err.message);
    process.exit(1);
  }
}

// Handle uncaught exceptions cleanly
process.on("uncaughtException", (err) => {
  console.error("[Fatal Exception] Uncaught:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Fatal Rejection] Unhandled:", reason);
});

start();