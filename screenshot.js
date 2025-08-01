const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Go to localhost where the app is being served
  await page.goto("http://localhost:5000", { waitUntil: "networkidle" });

  // Take full-page screenshot
  const screenshot = await page.screenshot({ fullPage: true });

  // Save as lossless WebP
  const outputPath = path.resolve(__dirname, "screenshot.webp");
  await sharp(screenshot)
    .webp({ lossless: true, quality: 100, effort: 6 })
    .toFile(outputPath);

  console.log(`✅ Screenshot saved at ${outputPath}`);

  await browser.close();
})();
