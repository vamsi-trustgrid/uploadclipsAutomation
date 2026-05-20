const { app, BrowserWindow, session } = require("electron");
const path = require("path");

// ─── Credentials ─────────────────────────────────────────────────────────────
// Add all 10 accounts here
const ACCOUNTS = [
  { id: 1, username: "account1@gmail.com", password: "password1" },
  { id: 2, username: "account2@gmail.com", password: "password2" },
  { id: 3, username: "account3@gmail.com", password: "password3" },
  { id: 4, username: "account4@gmail.com", password: "password4" },
  { id: 5, username: "account5@gmail.com", password: "password5" },
  { id: 6, username: "account6@gmail.com", password: "password6" },
  { id: 7, username: "account7@gmail.com", password: "password7" },
  { id: 8, username: "account8@gmail.com", password: "password8" },
  { id: 9, username: "account9@gmail.com", password: "password9" },
  { id: 10, username: "account10@gmail.com", password: "password10" },
];
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Native keystroke typing ───────────────────────────────────────────────────
async function sendChar(wc, char) {
  wc.sendInputEvent({ type: "keyDown", keyCode: char });
  wc.sendInputEvent({ type: "char",    keyCode: char });
  wc.sendInputEvent({ type: "keyUp",   keyCode: char });
  await sleep(80 + Math.floor(Math.random() * 80));
}

async function typeString(wc, text) {
  for (const char of text) {
    await sendChar(wc, char);
  }
}

async function focusAndType(wc, selector, text) {
  await wc.executeJavaScript(`
    (function() {
      const el = document.querySelector('${selector}');
      if (el) { el.focus(); el.click(); }
    })();
  `);
  await sleep(500);
  await typeString(wc, text);
  await sleep(300);
}

async function waitForSelector(wc, selector, maxMs) {
  maxMs = maxMs || 20000;
  const interval = 500;
  let elapsed = 0;
  while (elapsed < maxMs) {
    const found = await wc.executeJavaScript(
      `!!document.querySelector('${selector}')`
    );
    if (found) return true;
    await sleep(interval);
    elapsed += interval;
  }
  return false;
}

// ── Detect if already logged in ───────────────────────────────────────────────
async function isAlreadyLoggedIn(wc) {
  return await wc.executeJavaScript(`
    (function() {
      const hasNav = !!document.querySelector('nav');
      const noLoginForm = !document.querySelector('input[name="email"]');
      const els = Array.from(document.querySelectorAll("a, button, [role='button']"));
      const noLoginBtn = !els.find(function(el) {
        const t = (el.innerText || el.textContent || "").trim().toLowerCase();
        return t === "log in";
      });
      return hasNav && noLoginForm && noLoginBtn;
    })();
  `);
}

// ── Action to perform after login ─────────────────────────────────────────────
// TODO: implement your action here when ready
async function performAction(wc, account) {
  console.log("[Account " + account.id + "] Performing action... (not yet implemented)");
  // Example: await wc.executeJavaScript(`...`);
}

// ── Full login flow for a single account ─────────────────────────────────────
async function loginFlow(wc, account) {
  const tag = "[Account " + account.id + "]";

  // Wait for React to mount
  await sleep(3000);

  // Check if already logged in (persisted session from last run)
  const loggedIn = await isAlreadyLoggedIn(wc);
  if (loggedIn) {
    console.log(tag + " Already logged in via saved session. Skipping login.");
    await performAction(wc, account);
    return;
  }

  console.log(tag + " Starting login...");

  // Step 1: Find email input or click Log in button until form appears
  let emailFound = false;
  for (let i = 0; i < 20; i++) {
    const hasEmail = await wc.executeJavaScript(
      `!!document.querySelector('input[name="email"]')`
    );
    if (hasEmail) {
      console.log(tag + " Email input found.");
      emailFound = true;
      break;
    }

    const clicked = await wc.executeJavaScript(`
      (function() {
        const els = Array.from(document.querySelectorAll("a, button, [role='button']"));
        const btn = els.find(function(el) {
          const t = (el.innerText || el.textContent || "").trim().toLowerCase();
          return t === "log in";
        });
        if (btn) { btn.click(); return true; }
        return false;
      })();
    `);

    if (clicked) {
      console.log(tag + " Clicked Log in button. Waiting for form...");
    } else {
      console.log(tag + " Waiting for page... attempt " + (i + 1) + "/20");
    }

    await sleep(1000);
  }

  if (!emailFound) {
    console.error(tag + " Could not find email input. Aborting.");
    return;
  }

  // Step 2: Wait for password field
  const passFound = await waitForSelector(wc, 'input[name="pass"]', 10000);
  if (!passFound) {
    console.error(tag + " Password input not found. Aborting.");
    return;
  }

  console.log(tag + " Both fields ready. Typing credentials...");
  await sleep(1500);

  // Step 3: Type username
  console.log(tag + " Typing username...");
  await focusAndType(wc, 'input[name="email"]', account.username);

  await sleep(700);

  // Step 4: Type password
  console.log(tag + " Typing password...");
  await focusAndType(wc, 'input[name="pass"]', account.password);

  await sleep(700);

  // Step 5: Submit
  const submitted = await wc.executeJavaScript(`
    (function() {
      const btn = Array.from(document.querySelectorAll("[role='button']")).find(function(el) {
        return el.textContent.trim() === 'Log in';
      });
      if (btn) { btn.click(); return true; }
      return false;
    })();
  `);
  console.log(tag + (submitted ? " Login submitted." : " Submit button not found."));

  if (!submitted) return;

  // Step 6: Handle "Save Info" / "Not now" prompt
  console.log(tag + " Watching for Save Info prompt...");
  let elapsed = 0;
  while (elapsed < 15000) {
    const clicked = await wc.executeJavaScript(`
      (function() {
        const btn = Array.from(document.querySelectorAll("[role='button']")).find(function(el) {
          return el.textContent.trim() === 'Not now';
        });
        if (btn) { btn.click(); return true; }
        return false;
      })();
    `);
    if (clicked) {
      console.log(tag + " Clicked 'Not now' on Save Info prompt.");
      break;
    }
    await sleep(500);
    elapsed += 500;
  }

  // Step 7: Wait for home feed to load then perform action
  console.log(tag + " Waiting for home feed...");
  await waitForSelector(wc, 'nav', 15000);
  console.log(tag + " Home feed loaded. Running action...");
  await performAction(wc, account);
}

// ── Create a window for one account ──────────────────────────────────────────
function createAccountWindow(account) {
  // Each account gets its own persistent session stored in a separate folder
  const userDataPath = path.join(app.getPath("userData"), "sessions", "account-" + account.id);
  const accountSession = session.fromPartition("persist:account-" + account.id, {
    cache: true,
  });

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // open in background
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      session: accountSession,
    },
  });

  let flowStarted = false;

  win.webContents.on("did-finish-load", () => {
    const url = win.webContents.getURL();
    console.log("[Account " + account.id + "] Page loaded:", url);

    // Skip post-login intermediate pages
    const skipPages = ["/accounts/onetap/", "/accounts/privacy/"];
    if (skipPages.some((p) => url.includes(p))) return;

    // Only run login flow once per session
    if (flowStarted) return;
    flowStarted = true;

    loginFlow(win.webContents, account).catch((err) =>
      console.error("[Account " + account.id + "] Error:", err)
    );
  });

  win.loadURL("https://www.instagram.com/");

  win.on("closed", () => {
    console.log("[Account " + account.id + "] Window closed.");
  });

  return win;
}

// ── App entry point ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  console.log("[Main] Launching " + ACCOUNTS.length + " account windows...");

  // Open all windows simultaneously
  ACCOUNTS.forEach((account) => {
    createAccountWindow(account);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    ACCOUNTS.forEach((account) => createAccountWindow(account));
  }
});










/**
 * 


// const { app, BrowserWindow } = require("electron");

// // ─── Credentials ─────────────────────────────────────────────────────────────
// const USERNAME = "ylovingly35@gmail.com";
// const PASSWORD = "yourslovingly";
// // ─────────────────────────────────────────────────────────────────────────────

// let mainWindow;

// function sleep(ms) {
//   return new Promise((r) => setTimeout(r, ms));
// }

// async function sendChar(wc, char) {
//   wc.sendInputEvent({ type: "keyDown", keyCode: char });
//   wc.sendInputEvent({ type: "char",    keyCode: char });
//   wc.sendInputEvent({ type: "keyUp",   keyCode: char });
//   await sleep(80 + Math.floor(Math.random() * 80));
// }

// async function typeString(wc, text) {
//   for (const char of text) {
//     await sendChar(wc, char);
//   }
// }

// async function focusAndType(wc, selector, text) {
//   // Click element to focus it
//   await wc.executeJavaScript(`
//     (function() {
//       const el = document.querySelector('${selector}');
//       if (el) { el.focus(); el.click(); }
//     })();
//   `);
//   await sleep(500);

//   // Type using native OS-level key events
//   await typeString(wc, text);
//   await sleep(300);
// }

// // Poll DOM until selector appears, return true or false
// async function waitForSelector(wc, selector, maxMs) {
//   maxMs = maxMs || 20000;
//   const interval = 500;
//   let elapsed = 0;
//   while (elapsed < maxMs) {
//     const found = await wc.executeJavaScript(
//       `!!document.querySelector('${selector}')`
//     );
//     if (found) return true;
//     await sleep(interval);
//     elapsed += interval;
//   }
//   return false;
// }

// async function runLoginFlow(wc) {
//   console.log("[Main] Starting login flow...");

//   // Step 1: Wait for page to settle
//   await sleep(3000);

//   // Step 2: Try clicking "Log in" button if visible (landing page)
//   // Keep retrying until either:
//   //   a) the email input appears (login form loaded), or
//   //   b) we successfully click Log in and then wait for email input
//   let emailFound = false;

//   for (let i = 0; i < 20; i++) {
//     // Check if login form is already visible
//     const hasEmail = await wc.executeJavaScript(
//       `!!document.querySelector('input[name="email"]')`
//     );

//     if (hasEmail) {
//       console.log("[Main] Email input found on attempt " + (i + 1));
//       emailFound = true;
//       break;
//     }

//     // Login form not visible yet — try clicking "Log in" button
//     const clicked = await wc.executeJavaScript(`
//       (function() {
//         const els = Array.from(document.querySelectorAll("a, button, [role='button']"));
//         const btn = els.find(function(el) {
//           const t = (el.innerText || el.textContent || "").trim().toLowerCase();
//           return t === "log in";
//         });
//         if (btn) { btn.click(); return true; }
//         return false;
//       })();
//     `);

//     if (clicked) {
//       console.log("[Main] Clicked Log in button on attempt " + (i + 1) + ". Waiting for form...");
//     } else {
//       console.log("[Main] Neither email input nor Log in button found yet. Retry " + (i + 1) + "/20...");
//     }

//     await sleep(1000);
//   }

//   if (!emailFound) {
//     console.error("[Main] Could not find email input after all retries.");
//     return;
//   }

//   // Step 3: Wait for password field too
//   const passFound = await waitForSelector(wc, 'input[name="pass"]', 10000);
//   if (!passFound) {
//     console.error("[Main] Password input not found.");
//     return;
//   }

//   console.log("[Main] Both fields ready. Settling 1.5s before typing...");
//   await sleep(1500);

//   // Step 4: Type username
//   console.log("[Main] Typing username...");
//   await focusAndType(wc, 'input[name="email"]', USERNAME);

//   const uVal = await wc.executeJavaScript(
//     `document.querySelector('input[name="email"]').value`
//   );
//   console.log("[Main] Username field value after typing:", uVal);

//   await sleep(700);

//   // Step 5: Type password
//   console.log("[Main] Typing password...");
//   await focusAndType(wc, 'input[name="pass"]', PASSWORD);

//   await sleep(700);

//   // Step 6: Submit
//   const submitted = await wc.executeJavaScript(`
//     (function() {
//       const btn = Array.from(document.querySelectorAll("[role='button']")).find(function(el){ return el.textContent.trim() === 'Log in'; });
//       if (btn) { btn.click(); return true; }
//       return false;
//     })();
//   `);

//   console.log(submitted ? "[Main] Login submitted." : "[Main] Submit button not found.");

//   // Step 7: Handle "Save Info" prompt — click "Not now"
//   if (submitted) {
//     console.log("[Main] Waiting for Save Info prompt...");
//     const interval = 500;
//     let elapsed = 0;
//     const maxMs = 15000;

//     while (elapsed < maxMs) {
//       const clicked = await wc.executeJavaScript(`
//         (function() {
//           const btn = Array.from(document.querySelectorAll("[role='button']")).find(function(el) {
//             return el.textContent.trim() === 'Not now';
//           });
//           if (btn) { btn.click(); return true; }
//           return false;
//         })();
//       `);

//       if (clicked) {
//         console.log("[Main] Clicked 'Not now' on Save Info prompt.");
//         break;
//       }

//       await sleep(interval);
//       elapsed += interval;
//     }

//     if (elapsed >= maxMs) {
//       console.log("[Main] Save Info prompt did not appear — skipping.");
//     }
//   }
// }

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1200,
//     height: 800,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//     },
//   });

//   mainWindow.loadURL("https://www.instagram.com/");

//   mainWindow.webContents.on("did-finish-load", () => {
//     const url = mainWindow.webContents.getURL();
//     console.log("[Main] Page loaded:", url);
//     // Single entry point — handles both landing and login page
//     runLoginFlow(mainWindow.webContents).catch(console.error);
//   });

//   mainWindow.on("closed", () => { mainWindow = null; });
// }

// app.whenReady().then(createWindow);

// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") app.quit();
// });

// app.on("activate", () => {
//   if (BrowserWindow.getAllWindows().length === 0) createWindow();
// });

 */


//old working code for single account login, kept for reference when implementing multiple accounts with separate sessions

// const { app, BrowserWindow, session } = require("electron");

// // ─── Config ───────────────────────────────────────────────────────────────────
// const USERNAME = "ylovingly35@gmail.com";
// const PASSWORD = "yourslovingly";
// const REELS_TO_COLLECT = 2; // change to 20 when ready
// const DOWNLOADER_URL = "https://fastdl.app/en2";
// // ─────────────────────────────────────────────────────────────────────────────


// let mainWindow;
// let downloaderWindow;

// function sleep(ms) {
//   return new Promise((r) => setTimeout(r, ms));
// }

// async function sendChar(wc, char) {
//   wc.sendInputEvent({ type: "keyDown", keyCode: char });
//   wc.sendInputEvent({ type: "char",    keyCode: char });
//   wc.sendInputEvent({ type: "keyUp",   keyCode: char });
//   await sleep(80 + Math.floor(Math.random() * 80));
// }

// async function typeString(wc, text) {
//   for (const char of text) await sendChar(wc, char);
// }

// async function focusAndType(wc, selector, text) {
//   await wc.executeJavaScript(`
//     (function() {
//       const el = document.querySelector('${selector}');
//       if (el) { el.focus(); el.click(); }
//     })();
//   `);
//   await sleep(500);
//   await typeString(wc, text);
//   await sleep(300);
// }

// async function waitForSelector(wc, selector, maxMs) {
//   maxMs = maxMs || 20000;
//   const interval = 500;
//   let elapsed = 0;
//   while (elapsed < maxMs) {
//     const found = await wc.executeJavaScript(`!!document.querySelector('${selector}')`);
//     if (found) return true;
//     await sleep(interval);
//     elapsed += interval;
//   }
//   return false;
// }

// async function isAlreadyLoggedIn(wc) {
//   return await wc.executeJavaScript(`
//     (function() {
//       const hasNav = !!document.querySelector('nav');
//       const noLoginForm = !document.querySelector('input[name="email"]');
//       const els = Array.from(document.querySelectorAll("a, button, [role='button']"));
//       const noLoginBtn = !els.find(function(el) {
//         return (el.innerText || el.textContent || "").trim().toLowerCase() === "log in";
//       });
//       return hasNav && noLoginForm && noLoginBtn;
//     })();
//   `);
// }

// // ── LOGIN ─────────────────────────────────────────────────────────────────────
// async function loginFlow(wc) {
//   await sleep(3000);
//   const loggedIn = await isAlreadyLoggedIn(wc);
//   if (loggedIn) { console.log("[Login] Already logged in."); return true; }

//   console.log("[Login] Starting login...");
//   let emailFound = false;
//   for (let i = 0; i < 20; i++) {
//     const hasEmail = await wc.executeJavaScript(`!!document.querySelector('input[name="email"]')`);
//     if (hasEmail) { emailFound = true; break; }
//     const clicked = await wc.executeJavaScript(`
//       (function() {
//         const els = Array.from(document.querySelectorAll("a, button, [role='button']"));
//         const btn = els.find(function(el) {
//           return (el.innerText || el.textContent || "").trim().toLowerCase() === "log in";
//         });
//         if (btn) { btn.click(); return true; }
//         return false;
//       })();
//     `);
//     if (clicked) console.log("[Login] Clicked Log in button...");
//     await sleep(1000);
//   }
//   if (!emailFound) { console.error("[Login] Email input not found."); return false; }

//   await waitForSelector(wc, 'input[name="pass"]', 10000);
//   await sleep(1500);
//   console.log("[Login] Typing username...");
//   await focusAndType(wc, 'input[name="email"]', USERNAME);
//   await sleep(700);
//   console.log("[Login] Typing password...");
//   await focusAndType(wc, 'input[name="pass"]', PASSWORD);
//   await sleep(700);

//   const submitted = await wc.executeJavaScript(`
//     (function() {
//       const btn = Array.from(document.querySelectorAll("[role='button']")).find(function(el) {
//         return el.textContent.trim() === 'Log in';
//       });
//       if (btn) { btn.click(); return true; }
//       return false;
//     })();
//   `);
//   if (!submitted) { console.error("[Login] Submit not found."); return false; }

//   let elapsed = 0;
//   while (elapsed < 15000) {
//     const clicked = await wc.executeJavaScript(`
//       (function() {
//         const btn = Array.from(document.querySelectorAll("[role='button']")).find(function(el) {
//           return el.textContent.trim() === 'Not now';
//         });
//         if (btn) { btn.click(); return true; }
//         return false;
//       })();
//     `);
//     if (clicked) { console.log("[Login] Clicked 'Not now'."); break; }
//     await sleep(500);
//     elapsed += 500;
//   }
//   await waitForSelector(wc, 'nav', 15000);
//   console.log("[Login] Home feed loaded.");
//   return true;
// }

// // ── COLLECT REEL LINKS ────────────────────────────────────────────────────────
// async function collectReelLinks(wc) {
//   console.log("[Reels] Navigating to Reels tab...");
//   const reelsClicked = await wc.executeJavaScript(`
//     (function() {
//       const el = document.querySelector('a[href="/reels/"]');
//       if (el) { el.click(); return true; }
//       return false;
//     })();
//   `);
//   if (!reelsClicked) { console.error("[Reels] Reels nav not found."); return []; }

//   console.log("[Reels] Waiting for reels to load...");
//   await sleep(4000);

//   // Install execCommand interceptor once
//   await wc.executeJavaScript(`
//     window.__capturedReelLink = null;
//     window.__lastCapturedLink = null;
//     const origExec = document.execCommand.bind(document);
//     document.execCommand = function(cmd) {
//       if (cmd === "copy") {
//         const active = document.activeElement;
//         const sel = window.getSelection();
//         const link = (active && active.value) || sel.toString() || "";
//         if (link.includes("instagram.com/reel")) {
//           window.__capturedReelLink = link;
//           window.__lastCapturedLink = link;
//           console.log("[Reels] Intercepted:", link);
//         }
//       }
//       return origExec.apply(document, arguments);
//     };
//     console.log("[Reels] Interceptor installed.");
//   `);

//   const reelLinks = [];

//   for (let i = 0; i < REELS_TO_COLLECT; i++) {
//     console.log("[Reels] Collecting reel " + (i + 1) + "/" + REELS_TO_COLLECT + "...");

//     // Reset ONLY the current capture slot — not lastCaptured
//     await wc.executeJavaScript(`window.__capturedReelLink = null;`);

//     // Click Share on the reel closest to center of viewport
//     const shareClicked = await wc.executeJavaScript(`
//       (function() {
//         const svgs = Array.from(document.querySelectorAll('svg[aria-label="Share"]'));
//         if (svgs.length === 0) return false;

//         // Find SVG closest to vertical center of viewport
//         const viewportCenter = window.innerHeight / 2;
//         let closestSvg = null;
//         let closestDist = Infinity;
//         svgs.forEach(function(svg) {
//           const rect = svg.getBoundingClientRect();
//           if (rect.width === 0 || rect.height === 0) return;
//           const dist = Math.abs((rect.top + rect.height / 2) - viewportCenter);
//           if (dist < closestDist) { closestDist = dist; closestSvg = svg; }
//         });
//         if (!closestSvg) return false;

//         // Walk up DOM to find clickable ancestor
//         let el = closestSvg.parentElement;
//         for (let j = 0; j < 8; j++) {
//           if (!el || el.tagName === 'BODY') break;
//           if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
//             el.click();
//             return true;
//           }
//           el = el.parentElement;
//         }
//         // Fallback: 3 levels up
//         closestSvg.parentElement.parentElement.parentElement.click();
//         return true;
//       })();
//     `);

//     if (!shareClicked) {
//       console.error("[Reels] Share button not found on reel " + (i + 1));
//       await sleep(2000);
//       continue;
//     }

//     // Wait for share sheet
//     await sleep(1500);

//     // Click "Copy link"
//     const copyClicked = await wc.executeJavaScript(`
//       (function() {
//         const spans = Array.from(document.querySelectorAll("SPAN")).filter(function(el) {
//           return el.textContent.trim().toLowerCase() === "copy link";
//         });
//         if (spans.length === 0) return false;
//         spans[0].parentElement.parentElement.click();
//         return true;
//       })();
//     `);

//     if (!copyClicked) {
//       console.error("[Reels] Copy link not found on reel " + (i + 1));
//       await wc.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
//       await sleep(1000);
//       continue;
//     }

//     // Wait for execCommand to fire
//     await sleep(800);

//     const link = await wc.executeJavaScript(`window.__capturedReelLink || null`);

//     if (link) {
//       // Check it's not a duplicate of previous
//       if (reelLinks.length > 0 && reelLinks[reelLinks.length - 1] === link) {
//         console.log("[Reels] Warning: same link as previous — scroll may not have worked.");
//       }
//       console.log("[Reels] Got link " + (i + 1) + ": " + link);
//       reelLinks.push(link);
//     } else {
//       console.error("[Reels] No link captured for reel " + (i + 1));
//     }

//     // Close share sheet - click X button or fallback to Escape
//     const shareClosed = await wc.executeJavaScript(`
//       (function() {
//         const closeSelectors = ["[aria-label='Close']", "[aria-label='close']"];
//         for (const sel of closeSelectors) {
//           const el = document.querySelector(sel);
//           if (el && el.offsetParent !== null) {
//             const target = el.tagName === "SVG" ? el.parentElement : el;
//             target.click();
//             return true;
//           }
//         }
//         return false;
//       })();
//     `);
//     if (shareClosed) {
//       console.log("[Reels] Closed share sheet via X button.");
//     } else {
//       await wc.executeJavaScript(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));`);
//       console.log("[Reels] Closed share sheet via Escape.");
//     }
//     await sleep(800);

//     // Focus the page first, then send native ArrowDown
//     mainWindow.focus();
//     wc.focus();
//     await sleep(300);
//     wc.sendInputEvent({ type: "keyDown", keyCode: "Down" });
//     wc.sendInputEvent({ type: "keyUp",   keyCode: "Down" });
//     console.log("[Reels] Sent ArrowDown. Waiting for next reel...");
//     await sleep(3500);
//   }

//   console.log("[Reels] Collected " + reelLinks.length + "/" + REELS_TO_COLLECT + " links:");
//   reelLinks.forEach(function(l, idx) { console.log("  " + (idx + 1) + ". " + l); });
//   return reelLinks;
// }

// // ── DOWNLOAD REELS ────────────────────────────────────────────────────────────
// async function downloadReels(links) {
//   console.log("[Downloader] Starting downloads for " + links.length + " reels...");


//   // Known ad/spam domains to ignore
//   const AD_DOMAINS = ["savefrompin.to", "123tik.com", "background-remover.com", "fastdl.app/faq",
//     "fastdl.app/video", "fastdl.app/photo", "fastdl.app/story", "fastdl.app/igtv",
//     "fastdl.app/carousel", "fastdl.app/instagram"];

//   downloaderWindow = new BrowserWindow({
//     width: 1200,
//     height: 800,
//     show: true,
//     webPreferences: { nodeIntegration: false, contextIsolation: true },
//   });

//   // Auto-save downloads to ~/Downloads without showing OS save dialog
//   const downloadPath = require("path").join(__dirname, "downloads");
//   require("fs").mkdirSync(downloadPath, { recursive: true });
//   downloaderWindow.webContents.session.on("will-download", (event, item) => {
//     const fileName = item.getFilename() || ("reel-" + Date.now() + ".mp4");
//     const savePath = require("path").join(downloadPath, fileName);
//     item.setSavePath(savePath);
//     console.log("[Downloader] Auto-saving to:", savePath);
//     item.on("updated", (e, state) => {
//       if (state === "progressing") process.stdout.write(".");
//     });
//     item.once("done", (e, state) => {
//       if (state === "completed") console.log("\n[Downloader] Saved:", savePath);
//       else console.log("\n[Downloader] Download failed:", state);
//     });
//   });

//   // Wait for session handler to be fully registered before first load
//   await sleep(500);

//   for (let i = 0; i < links.length; i++) {
//     const link = links[i];
//     console.log("[Downloader] (" + (i + 1) + "/" + links.length + ") Processing: " + link);

//     downloaderWindow.loadURL(DOWNLOADER_URL);
//     await new Promise((resolve) => downloaderWindow.webContents.once("did-finish-load", resolve));
//     await sleep(3500);

//     const wc = downloaderWindow.webContents;

//     // Step 1: Fill the input using exact selector #search-form-input
//     const inputFound = await waitForSelector(wc, "#search-form-input", 10000);
//     if (!inputFound) { console.error("[Downloader] Input not found."); continue; }

//     await wc.executeJavaScript(`
//       (function() {
//         const input = document.querySelector("#search-form-input");
//         if (!input) return;
//         const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
//         nativeSetter.call(input, "");
//         input.dispatchEvent(new Event("input", { bubbles: true }));
//         input.focus();
//       })();
//     `);
//     await sleep(300);
//     await typeString(wc, link);
//     await sleep(500);

//     // Step 2: Click the Download submit button (exact match)
//     const submitted = await wc.executeJavaScript(`
//       (function() {
//         const btn = Array.from(document.querySelectorAll("button")).find(function(el) {
//           return el.type === "submit" && el.textContent.trim() === "Download";
//         });
//         if (btn) { btn.click(); return true; }
//         return false;
//       })();
//     `);
//     if (!submitted) { console.error("[Downloader] Submit button not found."); continue; }
//     console.log("[Downloader] Clicked Download. Waiting for result...");

//     // Step 3: Wait for the real download link to appear (poll up to 15s)
//     let downloadHref = null;
//     for (let wait = 0; wait < 30; wait++) {
//       await sleep(500);

//       // Close any popup/ad windows that opened
//       const allWins = BrowserWindow.getAllWindows();
//       allWins.forEach(function(win) {
//         if (win !== mainWindow && win !== downloaderWindow) {
//           console.log("[Downloader] Closing popup window: " + win.webContents.getURL());
//           win.close();
//         }
//       });

//       // Try to find the real download anchor (must be from fastdl or cdninstagram)
//       downloadHref = await wc.executeJavaScript(`
//         (function() {
//           const anchors = Array.from(document.querySelectorAll("a[href]"));
//           const real = anchors.find(function(el) {
//             const href = el.href || "";
//             return (href.includes("media.fastdl.app") || href.includes("cdninstagram") || href.includes(".mp4")) &&
//                    !href.includes("savefrompin") && !href.includes("123tik") &&
//                    !href.includes("background-remover") && href.length > 50;
//           });
//           return real ? real.href : null;
//         })();
//       `);

//       if (downloadHref) break;
//     }

//     if (!downloadHref) {
//       console.error("[Downloader] Real download link not found for reel " + (i + 1));
//       continue;
//     }

//     console.log("[Downloader] Found download link. Triggering download...");

//     // Step 4: Click the real download link
//     await wc.executeJavaScript(`
//       (function() {
//         const anchors = Array.from(document.querySelectorAll("a[href]"));
//         const real = anchors.find(function(el) {
//           const href = el.href || "";
//           return (href.includes("media.fastdl.app") || href.includes("cdninstagram") || href.includes(".mp4")) &&
//                  !href.includes("savefrompin") && !href.includes("123tik") &&
//                  !href.includes("background-remover") && href.length > 50;
//         });
//         if (real) real.click();
//       })();
//     `);

//     console.log("[Downloader] Download triggered for reel " + (i + 1));
//     await sleep(6000); // wait for download to start before moving to next
//   }

//   console.log("[Downloader] All " + links.length + " reels processed.");
// }


// // ── MAIN ──────────────────────────────────────────────────────────────────────
// async function main(wc) {
//   const loggedIn = await loginFlow(wc);
//   if (!loggedIn) { console.error("[Main] Login failed."); return; }

//   const reelLinks = await collectReelLinks(wc);
//   if (reelLinks.length === 0) { console.error("[Main] No links."); return; }

  

//   await downloadReels(reelLinks);
//   // CLOSE INSTAGRAM WINDOW HERE
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     console.log("[Main] Closing Instagram window...");
//     mainWindow.close();
//     mainWindow = null;
//   }

//   // small delay to avoid race conditions
//   await sleep(1000);
//   console.log("[Main] Complete!");
// }

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1200,
//     height: 800,
//     show: true,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       session: session.fromPartition("persist:instagram-main"),
//     },
//   });
//   mainWindow.loadURL("https://www.instagram.com/");
//   mainWindow.webContents.once("did-finish-load", () => {
//     console.log("[Main] Page loaded. Starting...");
//     main(mainWindow.webContents).catch(console.error);
//   });
//   mainWindow.on("closed", () => { mainWindow = null; });
// }

// app.whenReady().then(createWindow);
// app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
// app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });