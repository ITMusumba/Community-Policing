// Renders the COMPOLI app icon (shield + location pin) to the PNG sizes the web manifest and iOS need.
// Usage: node scripts/build-icons.mjs   → public/icons/*
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const NAVY = "#0b1f33", GOLD = "#f5b301", WHITE = "#ffffff";

// Artwork on a 512 grid, centred on (256, 263). `scale` shrinks it for the maskable safe zone.
function mark(scale = 1) {
  return `<g transform="translate(256 263) scale(${scale}) translate(-256 -263)">
    <path d="M256 94 L396 136 C396 282 342 372 256 432 C170 372 116 282 116 136 Z" fill="none" stroke="${GOLD}" stroke-width="22" stroke-linejoin="miter"/>
    <path d="M256 356 L210 258 A56 56 0 1 1 302 258 Z" fill="${WHITE}"/>
    <circle cx="256" cy="226" r="23" fill="${NAVY}"/>
  </g>`;
}
const svg = ({ radius = 0, scale = 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${radius}" fill="${NAVY}"/>${mark(scale)}</svg>`;

const rounded = svg({ radius: 112 });
const square = svg();
const maskable = svg({ scale: 0.78 }); // Android crops maskable icons to a circle/squircle; keep the mark in the safe zone.

writeFileSync("public/icons/icon.svg", rounded);
const out = [
  ["icon-192.png", rounded, 192], ["icon-512.png", rounded, 512],
  ["maskable-192.png", maskable, 192], ["maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", square, 180], ["favicon-32.png", rounded, 32],
];
for (const [name, source, size] of out) await sharp(Buffer.from(source)).resize(size, size).png().toFile(`public/icons/${name}`);
console.log("icons written:", out.map(o => o[0]).join(", "));
