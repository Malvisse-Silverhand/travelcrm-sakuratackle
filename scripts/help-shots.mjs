// Regenerates the admin Help center screenshots and marker positions.
//
//   HELP_EMAIL=… HELP_PASSWORD=… node scripts/help-shots.mjs [baseUrl]
//
// baseUrl defaults to http://localhost:3000 (run `npm run dev` first).
// For every topic in lib/admin/help-topics.json it opens the page in
// headless Chrome, runs the topic's steps, replaces customer names, phones
// and emails ([data-pii]) with sample values, saves public/help/<slug>.jpg
// and records where each callout's element is in lib/admin/help-markers.json.
// Credentials come from the environment only and are never written.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.HELP_EMAIL;
const password = process.env.HELP_PASSWORD;
if (!email || !password) {
  console.error("Set HELP_EMAIL and HELP_PASSWORD (an admin account).");
  process.exit(1);
}
const chromePath =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const { topics } = JSON.parse(readFileSync(join(root, "lib/admin/help-topics.json"), "utf8"));
const outDir = join(root, "public/help");
mkdirSync(outDir, { recursive: true });

const WIDTH = 1440;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "help-shots-"))}`,
  "--hide-scrollbars",
  "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader",
  "--ignore-gpu-blocklist",
  "about:blank",
]);

let targets = [];
for (let i = 0; i < 60 && !targets.some((t) => t.type === "page"); i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    await sleep(250);
  }
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result
    ?.result?.value;
const viewport = (height) =>
  send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height, deviceScaleFactor: 1, mobile: false });

await send("Runtime.enable");
await viewport(900);

// Sign in through the real form.
await send("Page.navigate", { url: `${base}/admin/login` });
// The form is server-rendered: wait for it, then for React to hydrate,
// or typed values are reset (a cold dev server can take a while).
for (let i = 0; i < 120 && !(await js(`!!document.querySelector("form button[type=submit]")`)); i++) await sleep(500);
await sleep(9000);
await js(`(() => {
  const set = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const inputs = document.querySelectorAll("form input");
  set(inputs[0], ${JSON.stringify(email)});
  set(inputs[1], ${JSON.stringify(password)});
  document.querySelector("form button[type=submit]").click();
})()`);
for (let i = 0; i < 120 && (await js("location.pathname")) === "/admin/login"; i++) await sleep(500);
await sleep(2000);
if (!(await js("location.pathname")).startsWith("/admin") || (await js("location.pathname")) === "/admin/login") {
  console.error("Sign-in failed.");
  ws.close();
  chrome.kill();
  process.exit(1);
}

const SAMPLE_NAMES = ["Ahmad Faiz", "Nurul Aina", "Hafiz Rahman", "Siti Mariam", "Daniel Lim", "Aisyah Omar"];
const markers = {};

for (const topic of topics) {
  await viewport(900);
  await send("Page.navigate", { url: base + topic.path });
  await sleep(topic.path === "/admin" ? 10000 : 5000);

  for (const step of topic.steps ?? []) {
    if (step === "demo") {
      await js(`[...document.querySelectorAll("label")].find(l => l.textContent.trim() === "Demo")?.querySelector("input")?.click()`);
    } else if (step.startsWith("slider:")) {
      await js(`(() => {
        const r = document.querySelector("input[type=range]");
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(r, ${JSON.stringify(step.slice(7))});
        r.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
    } else if (step.startsWith("focus:")) {
      // Show only the card holding this element, so one Settings section
      // gets its own picture instead of being lost at the foot of the page.
      await js(`(() => {
        const card = document.querySelector(${JSON.stringify(step.slice(6))})?.closest("[class*='detailCard']");
        if (!card) return;
        document.querySelectorAll("[class*='detailCard']").forEach((c) => {
          if (c !== card && !c.contains(card) && !card.contains(c)) c.style.display = "none";
        });
      })()`);
    } else if (step.startsWith("click:")) {
      await js(`document.querySelector(${JSON.stringify(step.slice(6))})?.click()`);
    }
    await sleep(5000);
  }

  // The Next.js dev badge is not part of the admin.
  await js(`document.querySelectorAll("nextjs-portal").forEach((e) => e.remove())`);

  // Customer details never leave the admin in a picture.
  await js(`(() => {
    const names = ${JSON.stringify(SAMPLE_NAMES)};
    document.querySelectorAll("[data-pii]").forEach((el, i) => {
      const kind = el.getAttribute("data-pii");
      el.textContent =
        kind === "phone" ? "012-345 678" + (i % 10) :
        kind === "email" ? "pelanggan" + i + "@contoh.my" :
        names[i % names.length];
    });
  })()`);

  // Full page, so callouts below the fold are in the picture too.
  const height = Math.min(2200, Math.max(900, await js("document.documentElement.scrollHeight")));
  await viewport(height);
  await sleep(1500);

  const points = await js(`(() => ${JSON.stringify(topic.callouts.map((c) => c.selector))}.map((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    const x = Math.max(14, r.left + 4);
    const y = Math.max(14, r.top + Math.min(r.height / 2, 24));
    return { x: +(x / innerWidth * 100).toFixed(2), y: +(y / innerHeight * 100).toFixed(2) };
  }))()`);

  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 78 });
  writeFileSync(join(outDir, `${topic.slug}.jpg`), Buffer.from(shot.result.data, "base64"));
  markers[topic.slug] = { width: WIDTH, height, points };

  const missing = points.map((p, i) => (p ? null : topic.callouts[i].selector)).filter(Boolean);
  console.log(`${topic.slug}: ${height}px${missing.length ? `, no element for ${missing.join(" | ")}` : ""}`);
}

writeFileSync(join(root, "lib/admin/help-markers.json"), JSON.stringify(markers, null, 2) + "\n");
ws.close();
chrome.kill();
