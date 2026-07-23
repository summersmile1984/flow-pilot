#!/usr/bin/env node
/**
 * Semantic sanity check for a packed app.asar.
 *
 * Why this exists: the per-file SHA256 hashes in the asar header are computed
 * from the bytes electron-builder actually wrote, so a build that writes the
 * data section in a different order than the header describes still verifies
 * as "intact". We shipped exactly that once — every entry resolved to another
 * file's content, `package.json` came back as a fragment of a dev log, Electron
 * could not read `main`, and the app exited 0 with no window, no stderr and no
 * crash report. Hash checking cannot see it; reading the files can.
 *
 * Usage: node scripts/verify-asar.cjs "release/<ver>/mac-arm64/<Name>.app/Contents/Resources/app.asar"
 */
const fs = require("fs");

const archive = process.argv[2];
if (!archive) {
  console.error("usage: verify-asar.cjs <path to app.asar>");
  process.exit(2);
}

// ── Header ──

const fd = fs.openSync(archive, "r");
const sizeField = Buffer.alloc(8);
fs.readSync(fd, sizeField, 0, 8, 8);
const headerSize = sizeField.readUInt32LE(4);
const headerBuf = Buffer.alloc(headerSize);
fs.readSync(fd, headerBuf, 0, headerSize, 16);
const header = JSON.parse(headerBuf.toString("utf8"));
// The pickled header is padded out to a 4-byte boundary; the data section
// starts after the padding, not after the raw header length.
const base = 16 + headerSize + ((4 - (headerSize % 4)) % 4);

function entry(p) {
  let node = header;
  for (const seg of p.split("/").filter(Boolean)) {
    if (!node || !node.files) return null;
    node = node.files[seg];
  }
  return node && node.offset != null ? node : null;
}

function read(p) {
  const e = entry(p);
  if (!e) return null;
  const buf = Buffer.alloc(e.size);
  fs.readSync(fd, buf, 0, e.size, base + Number(e.offset));
  return buf.toString("utf8");
}

// ── Checks ──

const failures = [];
function check(label, fn) {
  try {
    const problem = fn();
    if (problem) failures.push(`${label}: ${problem}`);
    else console.log(`  ok  ${label}`);
  } catch (err) {
    failures.push(`${label}: ${err.message}`);
  }
}

let mainPath = null;

check("package.json parses and names an entry point", () => {
  const raw = read("package.json");
  if (raw === null) return "not present in the archive";
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return `content is not JSON — got ${JSON.stringify(raw.slice(0, 60))}`;
  }
  if (!pkg.main) return "no `main` field";
  mainPath = pkg.main;
  console.log(`      name=${pkg.name} productName=${pkg.productName} main=${pkg.main}`);
  return null;
});

check("main entry exists and is JavaScript", () => {
  if (!mainPath) return "skipped — package.json unreadable";
  const src = read(mainPath);
  if (src === null) return `${mainPath} is not in the archive`;
  // Bundled main process output: require/import or "use strict" near the top.
  if (!/\b(require|import|module\.exports|use strict)\b/.test(src.slice(0, 4096)))
    return `${mainPath} does not look like JS — got ${JSON.stringify(src.slice(0, 60))}`;
  return null;
});

check("index.html is HTML", () => {
  const html = read("index.html");
  if (html === null) return "not present in the archive";
  if (!/^\s*<!doctype html/i.test(html))
    return `does not start with a doctype — got ${JSON.stringify(html.slice(0, 60))}`;
  return null;
});

fs.closeSync(fd);

if (failures.length) {
  console.error("\nasar verification FAILED:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("\nThe archive's header and data section disagree. Rebuild from a clean");
  console.error("release/ dir; do not ship this build.");
  process.exit(1);
}
console.log("\nasar verification passed.");
