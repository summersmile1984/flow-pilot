/**
 * LibreOffice-backed document→PDF conversion, used for formats that have no
 * faithful in-browser renderer — currently Apple iWork files (Pages / Numbers /
 * Keynote), whose bodies are a proprietary protobuf and whose embedded
 * QuickLook preview is only a single first-page image. LibreOffice imports the
 * real document (via libetonyek) and exports every page/slide to a PDF that
 * pdf.js then renders. Conversions are cached by source path + mtime.
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
const CONVERT_TIMEOUT_MS = 60_000;

let cachedBinary: string | null | undefined;

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
  ].filter((p): p is string => !!p);
  for (const candidate of candidates) {
    try { await fsp.access(candidate, fs.constants.X_OK); cachedBinary = candidate; return candidate; } catch { /* next */ }
  }
  try {
    const { stdout } = await execFileAsync(process.platform === "win32" ? "where" : "which", ["soffice"]);
    const found = stdout.split(/\r?\n/)[0]?.trim();
    if (found) { cachedBinary = found; return found; }
  } catch { /* not on PATH */ }
  cachedBinary = null;
  return null;
}

function cacheDir(): string {
  const dir = path.join(os.tmpdir(), "pilot-doc-convert");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Convert a document to PDF, returning the PDF path. Throws if soffice is absent. */
export async function convertToPdf(filePath: string): Promise<string> {
  const soffice = await resolveSoffice();
  if (!soffice) throw new Error("LibreOffice is not installed");

  const stat = await fsp.stat(filePath);
  const key = crypto.createHash("sha1").update(`${filePath}:${stat.mtimeMs}:${stat.size}`).digest("hex").slice(0, 16);
  const outPath = path.join(cacheDir(), `${key}.pdf`);
  try { await fsp.access(outPath); return outPath; } catch { /* miss */ }

  const workDir = path.join(cacheDir(), key);
  await fsp.mkdir(workDir, { recursive: true });
  try {
    await execFileAsync(soffice, ["--headless", "--convert-to", "pdf", "--outdir", workDir, filePath], { timeout: CONVERT_TIMEOUT_MS });
    const produced = (await fsp.readdir(workDir)).find((f) => f.toLowerCase().endsWith(".pdf"));
    if (!produced) throw new Error("Conversion produced no PDF");
    await fsp.rename(path.join(workDir, produced), outPath);
    log("office-convert", `Converted ${path.basename(filePath)} → PDF`);
    return outPath;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
