const path = require("path");
const fs = require("fs");

// --- afterPack: strip bloat from the asar archive ---
// electron-builder v26 has a bug where the `files` config (negation-only,
// positive whitelist, AND FileSet with filter) is only applied to
// nodeModuleFilePatterns (node_modules filtering), NOT to the app directory
// walker (firstOrDefaultFilePatterns). Even the built-in default exclusions
// (e.g. !**/{.git,...}) don't work — .git ends up in the asar.
//
// Workaround: afterPack runs after the asar is packed. We extract it, keep
// ONLY what the app needs at runtime (whitelist), and repack.
const KEEP_ENTRIES = new Set([
  "package.json",
  "index.html",
  "dist",         // Vite-bundled renderer output
  "electron",     // tsup-compiled main/preload (electron/dist/)
  "node_modules", // production dependencies (already filtered by electron-builder)
]);

// --- Packages electron-builder's dependency collector drops on the floor ---
// @standard-schema/spec is a types-only package: its CJS entry is literally
// `module.exports = {}` and its `main` points at a 0-byte index.js. The
// collector appears to treat that as having no runtime content and skips it,
// even when it is declared as a direct dependency.
//
// It is still required unconditionally at load time — @ai-sdk/provider-utils
// does `__reExport(exports, require("@standard-schema/spec"), module.exports)`
// at the top of its index.js — so a missing copy throws MODULE_NOT_FOUND the
// moment any ai-sdk provider is loaded, taking the Mastra/Pilot agent with it.
//
// Copy it in by hand. Node resolves upward from
// app.asar/node_modules/@ai-sdk/... so one copy at the root serves every
// requirer, aliased or not.
const FORCE_INCLUDE_PACKAGES = ["@standard-schema/spec"];

function forceIncludePackages(tmpDir) {
  for (const pkg of FORCE_INCLUDE_PACKAGES) {
    const src = path.join(__dirname, "node_modules", pkg);
    const dest = path.join(tmpDir, "node_modules", pkg);
    if (fs.existsSync(dest)) continue;
    if (!fs.existsSync(src)) {
      throw new Error(`afterPack: ${pkg} is missing from node_modules — cannot force-include it`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  • afterPack: force-included ${pkg}`);
  }
}

/**
 * Block until `app.asar` is actually on disk.
 *
 * `@electron/asar`'s `createPackage` resolves too early. `streamTransformedFile`
 * pipes each source file into the archive stream with `{ end: false }` and
 * resolves on the *read* stream's "end" — so it reports done once the source has
 * been read, not once the bytes have been written. `writeFileListToStream` then
 * finishes with `return out.end()`, and a WriteStream's `end()` returns the
 * stream, not a promise, so awaiting it is a no-op. `await createPackage(...)`
 * can therefore return with hundreds of MB still queued.
 *
 * That is not theoretical: it shipped a "successful" build whose asar had a
 * correct header and a data section that never finished writing. electron-builder
 * had already signed it, hashed it into `ElectronAsarIntegrity`, and rolled it
 * into a DMG. Electron could not parse `package.json`, so the app exited 0 with
 * no window, no stderr and no crash report.
 *
 * The archive is complete exactly when the last entry's declared end equals the
 * file size — the header is written first and states where the data must stop.
 */
async function waitForAsarFlush(asarPath, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let lastSize = -1;
  for (;;) {
    const size = fs.statSync(asarPath).size;
    const declaredEnd = declaredAsarEnd(asarPath, size);
    if (declaredEnd !== null && declaredEnd === size) return;
    if (Date.now() > deadline) {
      throw new Error(
        `afterPack: app.asar was still incomplete after ${timeoutMs}ms ` +
          `(size ${size}, expected ${declaredEnd ?? "unknown"}) — refusing to ship it`,
      );
    }
    lastSize = size;
    await new Promise((r) => setTimeout(r, 250));
    // A stalled write is a failure, not something to keep waiting on.
    if (fs.statSync(asarPath).size === lastSize && Date.now() > deadline - 1000) {
      throw new Error("afterPack: app.asar stopped growing while still incomplete");
    }
  }
}

/** End offset the asar header claims for its data section, or null if unreadable yet. */
function declaredAsarEnd(asarPath, size) {
  if (size < 16) return null;
  const fd = fs.openSync(asarPath, "r");
  try {
    const sizeField = Buffer.alloc(8);
    fs.readSync(fd, sizeField, 0, 8, 8);
    const headerSize = sizeField.readUInt32LE(4);
    if (!headerSize || 16 + headerSize > size) return null;
    const headerBuf = Buffer.alloc(headerSize);
    fs.readSync(fd, headerBuf, 0, headerSize, 16);
    let header;
    try {
      header = JSON.parse(headerBuf.toString("utf8"));
    } catch {
      return null;
    }
    // The pickled header is padded out to a 4-byte boundary.
    const base = 16 + headerSize + ((4 - (headerSize % 4)) % 4);
    let max = 0;
    (function walk(node) {
      for (const key of Object.keys(node.files || {})) {
        const f = node.files[key];
        if (f.files) walk(f);
        else if (f.offset != null) max = Math.max(max, Number(f.offset) + f.size);
      }
    })(header);
    return base + max;
  } finally {
    fs.closeSync(fd);
  }
}

async function afterPackHook(context) {
  const resourcesDir = ["darwin", "mas"].includes(context.electronPlatformName)
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
    : path.join(context.appOutDir, "resources");

  const asarPath = path.join(resourcesDir, "app.asar");
  if (!fs.existsSync(asarPath)) return;

  // @electron/asar is a transitive dep of electron-builder, always available
  const asar = require("@electron/asar");
  const tmpDir = path.join(resourcesDir, "_asar_tmp");

  console.log("  \u2022 afterPack: extracting asar to strip bloat...");
  asar.extractAll(asarPath, tmpDir);

  // Remove everything not in the whitelist
  const entries = fs.readdirSync(tmpDir);
  for (const entry of entries) {
    if (!KEEP_ENTRIES.has(entry)) {
      fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
    }
  }

  // Inside electron/, keep only dist/ (compiled JS), remove src/ and other dev files
  const electronDir = path.join(tmpDir, "electron");
  if (fs.existsSync(electronDir)) {
    for (const sub of fs.readdirSync(electronDir)) {
      if (sub !== "dist") {
        fs.rmSync(path.join(electronDir, sub), { recursive: true, force: true });
      }
    }
  }

  forceIncludePackages(tmpDir);

  console.log("  \u2022 afterPack: repacking asar...");
  // Build beside the target and rename into place. Writing straight to app.asar
  // means a repack that dies partway leaves a broken archive that electron-builder
  // will happily sign and ship.
  const stagedAsar = `${asarPath}.repacked`;
  fs.rmSync(stagedAsar, { force: true });
  await asar.createPackage(tmpDir, stagedAsar);
  await waitForAsarFlush(stagedAsar);
  fs.rmSync(asarPath, { force: true });
  fs.renameSync(stagedAsar, asarPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Log final size for visibility
  const finalSize = fs.statSync(asarPath).size;
  const mb = (finalSize / 1024 / 1024).toFixed(1);
  console.log(`  \u2022 afterPack: asar cleaned \u2014 ${mb} MB`);
}

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.flowpilot.app",
  productName: "Flow Pilot",

  directories: {
    output: "release/${version}",
    buildResources: "build",
  },

  // --- Files to include in the app ---
  // NOTE: Due to electron-builder v26 bug, these patterns only affect
  // nodeModuleFilePatterns (node_modules filtering). App directory exclusions
  // are handled by the afterPack hook above which strips bloat from the asar.
  files: [
    "!**/{test,tests,__tests__,__mocks__,spec,specs}/**",
    "!**/*.d.ts",
    "!**/*.d.cts",
    "!**/*.d.mts",
    "!**/*.map",
  ],

  // --- ASAR packing ---
  asar: true,
  asarUnpack: [
    "node_modules/node-pty/**",
    "node_modules/electron-liquid-glass/**",
    "node_modules/@anthropic-ai/claude-agent-sdk/cli.js",
    "node_modules/@anthropic-ai/claude-agent-sdk/*.wasm",
    "node_modules/@anthropic-ai/claude-agent-sdk/vendor/**",
    "node_modules/@anthropic-ai/claude-agent-sdk/manifest*.json",
  ],

  npmRebuild: true,
  nodeGypRebuild: false,
  includePdb: false,

  afterPack: afterPackHook,

  // --- macOS ---
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.developer-tools",
    icon: "build/icon.icon",
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    extendInfo: {
      NSMicrophoneUsageDescription: "Flow Pilot uses the microphone for voice dictation to transcribe speech into text.",
    },
  },

  dmg: {
    icon: "build/icon.icns",
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
    window: { width: 540, height: 380 },
  },

  // --- Windows ---
  win: {
    target: [{ target: "nsis", arch: ["x64", "arm64"] }],
    icon: "build/icon.ico",
    files: [
      "!node_modules/electron-liquid-glass/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/arm64-darwin/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/x64-darwin/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/arm64-linux/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/x64-linux/**",
      "!node_modules/node-pty/prebuilds/darwin-*/**",
      "!node_modules/node-pty/prebuilds/linux-*/**",
    ],
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
    deleteAppDataOnUninstall: false,
    // Include arch in filename so x64 and arm64 installers don't collide
    artifactName: "${productName}-Setup-${version}-${arch}.${ext}",
  },

  // --- Linux ---
  linux: {
    target: [
      { target: "AppImage" },
      { target: "deb" },
    ],
    category: "Development",
    icon: "build/icon.png",
    files: [
      "!node_modules/electron-liquid-glass/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/arm64-darwin/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/x64-darwin/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/arm64-win32/**",
      "!node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/x64-win32/**",
      "!node_modules/node-pty/prebuilds/darwin-*/**",
      "!node_modules/node-pty/prebuilds/win32-*/**",
    ],
  },

  deb: {
    depends: ["libnotify4", "libsecret-1-0"],
  },

  // --- Auto-update ---
  publish: {
    provider: "github",
    owner: "OpenSource03",
    repo: "pilot",
    releaseType: "release",
  },

  afterSign: "scripts/notarize.js",
};
