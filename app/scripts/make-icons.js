/*
 * Builds the app icons from assets/icon-source.jpg (the artwork Gary supplied):
 *   assets/icon.png                   1024 square: the rounded tile cropped out of the picture
 *   assets/adaptive-foreground.png    1024: the artwork, shrunk into Android's adaptive-icon safe zone
 *                                     and feathered into the flat colour app.json uses as its background
 * Run once after replacing the source: node scripts/make-icons.js
 */
const path = require('path');
const Jimp = require('jimp-compact');

const assets = path.join(__dirname, '..', 'assets');
const SIZE = 1024;

// Measured on the 784x1168 source: the tile spans x 50-735, y 195-940; the artwork x 120-665, y 220-830.
const TILE = { x: 50, y: 212, size: 685 };      // square cut from the tile
const ART = { x: 75, y: 190, w: 635, h: 700 }; // artwork plus tile around it, feathered away

async function main() {
  const src = await Jimp.read(path.join(assets, 'icon-source.jpg'));

  const tile = src.clone().crop(TILE.x, TILE.y, TILE.size, TILE.size).resize(SIZE, SIZE);
  await tile.writeAsync(path.join(assets, 'icon.png'));

  // Flat colour for the adaptive background: the tile just inside the artwork's left edge, mid height.
  const c = Jimp.intToRGBA(src.getPixelColor(ART.x + 12, 567));
  console.log(`adaptive background colour: #${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);

  // Artwork fits within the central 62% of the canvas (safe zone is 66%, so keep the artwork inside it).
  const scale = (SIZE * 0.66) / ART.h;
  const art = src.clone().crop(ART.x, ART.y, ART.w, ART.h).resize(Math.round(ART.w * scale), Math.round(ART.h * scale));
  // Feather the edges so the crop melts into the flat background colour.
  const F = 110;
  art.scan(0, 0, art.bitmap.width, art.bitmap.height, function (x, y, idx) {
    const d = Math.min(x, y, this.bitmap.width - 1 - x, this.bitmap.height - 1 - y);
    this.bitmap.data[idx + 3] = Math.round(255 * Math.min(1, d / F));
  });
  const fg = new Jimp(SIZE, SIZE, 0x00000000);
  fg.composite(art, Math.round((SIZE - art.bitmap.width) / 2), Math.round((SIZE - art.bitmap.height) / 2));
  await fg.writeAsync(path.join(assets, 'adaptive-foreground.png'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
