import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Render the vector source at native resolution; no screenshot of app UI.
const svg = await readFile(new URL("../public/icon-maskable.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`);
  await page.locator("svg").screenshot({ path: fileURLToPath(new URL("../public/icon-maskable-512-v2.png", import.meta.url)) });
} finally {
  await browser.close();
}
