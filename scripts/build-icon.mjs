// Regenerează webapp/public/assets/startica.ico din startica-icon.svg: Chrome headless
// rasterizează fiecare cadru exact la mărimea lui (fără scalare ulterioară de Windows la
// afișare în taskbar), apoi cadrele PNG sunt împachetate manual într-un .ico. Fără dependențe.
// Rulare: node scripts/build-icon.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SVG_PATH = join(ROOT, 'webapp/public/assets/startica-icon.svg');
const OUTPUT_PATH = join(ROOT, 'webapp/public/assets/startica.ico');
// 20/24/40 acoperă scalările intermediare din taskbar/Explorer (100%-200% DPI); Windows nu
// mai are ce să interpoleze între cadre învecinate.
const SIZES = [16, 20, 24, 32, 40, 48, 256];
// PNG-uri separate pentru webapp/public/manifest.json: fereastra Chrome/Edge pornită cu
// --app= își ia iconița din taskbar din manifest (dacă există), nu din .ico-ul launcher-ului —
// fără ele, Chrome cade pe favicon-ul mic din <link rel="icon"> și Windows îl scalează pixelat.
const MANIFEST_SIZES = [192, 512];
const MANIFEST_OUTPUT = size => join(ROOT, `webapp/public/assets/startica-${size}.png`);

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome nu a fost găsit la căile știute; regenerează iconul de pe o mașină cu Chrome instalat.');
}

/** @param {string} chromePath @param {string} svgMarkup @param {number} size @param {string} workDir */
function rasterize(chromePath, svgMarkup, size, workDir) {
  const htmlPath = join(workDir, `frame-${size}.html`);
  const pngPath = join(workDir, `frame-${size}.png`);
  // width/height 100% pe html/body/svg: SVG-ul umple exact fereastra headless, un singur pas de scalare.
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden}' +
    'svg{display:block;width:100%;height:100%}' +
    '</style></head><body>' +
    svgMarkup +
    '</body></html>';
  writeFileSync(htmlPath, html, 'utf8');
  execFileSync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--default-background-color=00000000',
    '--force-device-scale-factor=1',
    `--window-size=${size},${size}`,
    `--screenshot=${pngPath}`,
    htmlPath,
  ]);
  return readFileSync(pngPath);
}

/** @param {Buffer} png IHDR începe la octetul 16: lățime, înălțime (4+4, big-endian), apoi color type. */
function readPngHeader(png) {
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png.readUInt8(25),
  };
}

/** @param {{ size: number, png: Buffer }[]} frames */
function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // tip = icon
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + 16 * frames.length;
  const entries = [];
  for (const { size, png } of frames) {
    const entry = Buffer.alloc(16);
    const byteSize = size === 256 ? 0 : size; // 0 = 256, singura valoare reprezentabilă pe un octet
    entry.writeUInt8(byteSize, 0);
    entry.writeUInt8(byteSize, 1);
    entry.writeUInt8(0, 2); // fără paletă
    entry.writeUInt8(0, 3); // rezervat
    entry.writeUInt16LE(1, 4); // plane-uri de culoare
    entry.writeUInt16LE(32, 6); // biți per pixel (RGBA)
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...frames.map(frame => frame.png)]);
}

/** @param {(size: number) => Buffer} rasterizeSize @param {number} size */
function rasterizeChecked(rasterizeSize, size) {
  const png = rasterizeSize(size);
  const { width, height, colorType } = readPngHeader(png);
  if (width !== size || height !== size)
    throw new Error(`Cadrul ${size}px a ieșit ${width}x${height}, nu ${size}x${size}.`);
  // colorType 6 = RGBA, 4 = gri+alfa; oricare confirmă că fundalul a rămas transparent.
  if (colorType !== 6 && colorType !== 4)
    throw new Error(`Cadrul ${size}px nu are canal alfa (colorType=${colorType}).`);
  console.log(`Cadru ${size}px: ${width}x${height}, colorType=${colorType}, ${png.length} octeți`);
  return png;
}

function main() {
  const svgMarkup = readFileSync(SVG_PATH, 'utf8');
  const chromePath = findChrome();
  const workDir = mkdtempSync(join(tmpdir(), 'startica-icon-'));
  try {
    const rasterizeSize = size => rasterize(chromePath, svgMarkup, size, workDir);
    const frames = SIZES.map(size => ({ size, png: rasterizeChecked(rasterizeSize, size) }));
    const ico = buildIco(frames);
    writeFileSync(OUTPUT_PATH, ico);
    console.log(`Scris ${OUTPUT_PATH} (${ico.length} octeți, ${frames.length} cadre)`);

    for (const size of MANIFEST_SIZES) {
      const png = rasterizeChecked(rasterizeSize, size);
      const outPath = MANIFEST_OUTPUT(size);
      writeFileSync(outPath, png);
      console.log(`Scris ${outPath} (${png.length} octeți)`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
