// Renders the DataCommand logo into the PWA icon set: `node scripts/generate-icons.mjs`.
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const glyph = (scale = 1) => {
  const t = (256 * (1 - scale)).toFixed(1);
  return `
  <g transform="translate(${t} ${t}) scale(${scale})">
    <path d="M136 168 L232 256 L136 344" fill="none" stroke="url(#glyph)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="268" y="296" width="44" height="64" rx="12" fill="#5b9dff"/>
    <rect x="328" y="236" width="44" height="124" rx="12" fill="#a78bfa"/>
    <rect x="388" y="168" width="44" height="192" rx="12" fill="#f5b83d"/>
  </g>`;
};

const svg = ({ rounded, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16213a"/>
      <stop offset="1" stop-color="#090b10"/>
    </linearGradient>
    <linearGradient id="glyph" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7cb2ff"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  ${rounded
    ? '<rect width="512" height="512" rx="112" fill="url(#bg)"/><rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="#2b3a5c" stroke-width="4"/>'
    : '<rect width="512" height="512" fill="url(#bg)"/>'}
  ${glyph(scale)}
</svg>
`;

const standard = svg({ rounded: true, scale: 1 });
const fullBleed = svg({ rounded: false, scale: 0.72 });

await writeFile("src/app/icon.svg", standard);
await sharp(Buffer.from(standard)).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(standard)).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(fullBleed)).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(Buffer.from(fullBleed)).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
console.log("Icons written to public/icons and src/app/icon.svg");
