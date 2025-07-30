// screenshot.js
const { chromium } = require("playwright");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Find all HTML files in root
function getHtmlFiles() {
  return fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith(".html"))
    .map((file) => path.basename(file, ".html"));
}

// Delete old .webp files
function deleteOldWebps() {
  fs.readdirSync(__dirname)
    .filter((file) => file.endsWith(".webp"))
    .forEach((file) => {
      fs.unlinkSync(path.join(__dirname, file));
      console.log(`🗑️ Deleted old screenshot: ${file}`);
    });
}

(async () => {
  deleteOldWebps();

  const examples = getHtmlFiles();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Using default viewport (1280x720) for full page screenshots

  for (const example of examples) {
    const filePath = `file://${path.resolve(__dirname, `${example}.html`)}`;
    console.log(`📸 Capturing ${filePath}`);

    await page.goto(filePath);
    await page.waitForLoadState("networkidle");

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: true,
    });

    await sharp(screenshot)
      .webp({ lossless: true, quality: 100, effort: 6 })
      .toFile(`${example}.webp`);

    console.log(`✅ Created ${example}.webp`);
  }

  await browser.close();
})();
