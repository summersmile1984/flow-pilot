/**
 * Office document preview via LibreOffice headless conversion to PDF.
 *
 * docx/xlsx/pptx (and legacy doc/xls/ppt) have no faithful in-browser renderer,
 * so we convert them to PDF with `soffice --headless` and let Electron's
 * built-in Chromium PDF viewer render the result. Conversions are cached by
 * source path + mtime so re-opening the same unchanged file is instant.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { log } from "./logger";

const execFileAsync = promisify(execFile);

/** Extensions we route through LibreOffice. */
export const OFFICE_EXTENSIONS = new Set([
  "docx", "doc", "odt", "rtf",
  "xlsx", "xls", "ods", "csv",
  "pptx", "ppt", "odp",
]);

const CONVERT_TIMEOUT_MS = 60_000;

let cachedBinary: string | null | undefined;

/** Locate the soffice/LibreOffice binary across common install locations. */
export async function resolveSoffice(): Promise<string | null> {
  if (cachedBinary !== undefined) return cachedBinary;

  const candidates = [
    process.env.PILOT_SOFFICE_PATH,
    "/opt/homebrew/bin/soffice",
    "/usr/local/bin/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ].filter((p): p is string => !!p);

  for (const candidate of candidates) {
    try {
      await fsp.access(candidate, fs.constants.X_OK);
      cachedBinary = candidate;
      return candidate;
    } catch { /* try next */ }
  }

  // Fall back to PATH lookup.
  try {
    const { stdout } = await execFileAsync(process.platform === "win32" ? "where" : "which", ["soffice"]);
    const found = stdout.split(/\r?\n/)[0]?.trim();
    if (found) {
      cachedBinary = found;
      return found;
    }
  } catch { /* not on PATH */ }

  cachedBinary = null;
  return null;
}

function cacheDir(): string {
  const dir = path.join(os.tmpdir(), "pilot-office-preview");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Convert an office file to PDF, returning the PDF path. Cached by source
 * path + mtime + size; a changed source reconverts. Throws if soffice is
 * unavailable or the conversion fails.
 */
export async function convertOfficeToPdf(filePath: string): Promise<string> {
  const soffice = await resolveSoffice();
  if (!soffice) {
    throw new Error("LibreOffice is not installed. Install it to preview Office files (e.g. `brew install --cask libreoffice`).");
  }

  const stat = await fsp.stat(filePath);
  const key = crypto.createHash("sha1").update(`${filePath}:${stat.mtimeMs}:${stat.size}`).digest("hex").slice(0, 16);
  const outPath = path.join(cacheDir(), `${key}.pdf`);

  try {
    await fsp.access(outPath);
    return outPath; // cache hit
  } catch { /* miss — convert */ }

  // soffice writes <basename>.pdf into --outdir; convert into a unique subdir
  // to avoid basename collisions, then move to the cache path.
  const workDir = path.join(cacheDir(), key);
  await fsp.mkdir(workDir, { recursive: true });
  try {
    await execFileAsync(
      soffice,
      ["--headless", "--convert-to", "pdf", "--outdir", workDir, filePath],
      { timeout: CONVERT_TIMEOUT_MS },
    );
    const produced = (await fsp.readdir(workDir)).find((f) => f.toLowerCase().endsWith(".pdf"));
    if (!produced) throw new Error("Conversion produced no PDF");
    await fsp.rename(path.join(workDir, produced), outPath);
    log("office-preview", `Converted ${path.basename(filePath)} → ${path.basename(outPath)}`);
    return outPath;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
