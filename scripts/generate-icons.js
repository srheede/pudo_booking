/**
 * Generates app icons for all platforms from the SVG truck icon.
 * Run: node scripts/generate-icons.js
 * Requires: sharp (npm install --save-dev sharp)
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const assetsDir = path.join(__dirname, "../assets");
fs.mkdirSync(assetsDir, { recursive: true });

// Blue rounded-square background with the HeroIcons delivery-truck path
const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" rx="200" ry="200" fill="#2563eb"/>
  <g transform="translate(112, 112) scale(33.33)" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>
  </g>
</svg>`;

async function generate() {
  const svgBuffer = Buffer.from(ICON_SVG);

  // 1024×1024 master PNG (used by electron-builder for macOS/Linux)
  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(assetsDir, "icon.png"));
  console.log("✓ assets/icon.png (1024×1024)");

  // 256×256 PNG (used by electron-builder for Windows ICO source)
  await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(assetsDir, "icon-256.png"));
  console.log("✓ assets/icon-256.png (256×256)");

  console.log("\nIcons generated successfully.");
  console.log("electron-builder will convert to .icns (macOS) and .ico (Windows) automatically during build.");
}

generate().catch((err) => {
  console.error("Icon generation failed:", err.message);
  process.exit(1);
});
