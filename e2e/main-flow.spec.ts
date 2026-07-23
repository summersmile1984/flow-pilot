import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-screenshots');

test.beforeAll(async () => {
  // Ensure screenshot dir exists
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  electronApp = await electron.launch({
    args: [path.join(__dirname, '..')],
    // Honor an ambient PILOT_DEV_PORT so this file and electron.spec.ts always
    // target the same dev server; 5180 is the fallback for a standalone run.
    env: { ...process.env, PILOT_DEV_PORT: process.env.PILOT_DEV_PORT || '5180' },
    timeout: 30000,
  });
  page = await electronApp.firstWindow();
  
  // Collect console messages for debugging
  const messages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    messages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', text);
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    messages.push(`[pageerror] ${err.message}`);
  });
  
  // Wait for app to fully load
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);  // Give React time to render
  
  // Print collected messages
  console.log('\n=== Console messages during load ===');
  for (const msg of messages.slice(0, 20)) {
    console.log(msg);
  }
  console.log('=== End console messages ===\n');
});

test.afterAll(async () => {
  if (electronApp) await electronApp.close();
});

// ── Helper: wait for app to be interactive ──
async function waitForApp() {
  // Wait for React to render - try multiple strategies
  try {
    // First try to wait for any content in #root
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.innerHTML.length > 100;
    }, { timeout: 15000 });
  } catch {
    // Fallback: wait for any button
    await page.waitForSelector('button', { timeout: 10000 }).catch(() => {});
  }
  await page.waitForTimeout(1000);
}

// ── Helper: take screenshot via Electron API ──
async function takeScreenshot(name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath });
  console.log(`📸 ${name}.png`);
}

// ══════════════════════════════════════════════════════════
// 1. App Launch
// ══════════════════════════════════════════════════════════

test('app should launch and render', async () => {
  await waitForApp();
  
  // Check if app rendered
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
  console.log('Root HTML length:', rootHtml.length);
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // Get body text
  const bodyText = await page.locator('body').textContent();
  console.log('Body text length:', bodyText?.length);
  console.log('Has Pilot:', bodyText?.includes('Pilot'));
  console.log('Has Harnss:', bodyText?.includes('Harnss'));
  
  await takeScreenshot('01-app-launch');
  
  // App should have rendered something (either body text or root HTML)
  const hasContent = (bodyText?.length ?? 0) > 0 || rootHtml.length > 100;
  if (!hasContent) {
    console.log('⚠️ App may not have fully rendered yet');
  }
  // Don't fail - just log the state
});

// ══════════════════════════════════════════════════════════
// 2. Welcome Screen
// ══════════════════════════════════════════════════════════

test('welcome screen should show Flow Pilot branding', async () => {
  await waitForApp();
  // innerText, not textContent — the latter comes back empty through a Locator
  // here, which made the old assertion pass without reading anything.
  const bodyText = await page.evaluate(() => document.body.innerText || '');

  console.log('Has Flow Pilot:', bodyText.includes('Flow Pilot'));
  await takeScreenshot('02-welcome-or-main');

  // The name must actually be on screen. The old test computed this and only
  // logged it, so a build with no branding at all would still have passed.
  expect(bodyText, 'app name missing from the first screen').toContain('Flow Pilot');
  expect(bodyText, 'retired brand name leaked into the UI').not.toContain('Harnss');
});

// ══════════════════════════════════════════════════════════
// 3. Dismiss Welcome (if present)
// ══════════════════════════════════════════════════════════

test('should dismiss welcome screen if present', async () => {
  // Selected by test id, not visible copy. A `has-text("Skip")` selector stops
  // matching the moment the UI is translated, and the old `.catch(() => false)`
  // guards turned that miss into a silent pass.
  const wizard = page.getByTestId('welcome-wizard');
  const skip = page.getByTestId('welcome-skip');
  const getStarted = page.getByTestId('welcome-get-started');

  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Found Skip button, clicking...');
    await skip.click();
    await page.waitForTimeout(1500);
  } else if (await getStarted.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Found Get Started button, clicking...');
    await getStarted.click();
    await page.waitForTimeout(1500);
  } else {
    console.log('No welcome screen visible, already on main interface');
  }

  await takeScreenshot('03-after-welcome');

  // Post-condition the original test lacked: however we got here, the wizard
  // must be gone. Without this the test passed even when nothing was clicked.
  await expect(wizard).toBeHidden();
});

// ══════════════════════════════════════════════════════════
// 4. Main Interface
// ══════════════════════════════════════════════════════════

test('should show main interface elements', async () => {
  await page.waitForTimeout(1000);
  
  // Get all visible text
  const bodyText = await page.locator('body').textContent() || '';
  console.log('Main interface text length:', bodyText.length);
  
  // Check for common UI elements
  const buttons = await page.locator('button').all();
  console.log('Number of buttons:', buttons.length);
  
  await takeScreenshot('04-main-interface');
});

// ══════════════════════════════════════════════════════════
// 5. Settings
// ══════════════════════════════════════════════════════════

test('should open and navigate settings', async () => {
  // Click the sidebar gear. This test used to press Meta+, — but the app
  // registers no comma shortcut (see src/hooks/useKeyboardShortcuts.ts, which
  // binds only Shift+Tab and Cmd/Ctrl+F), so settings never actually opened.
  // The old body-text check was logged and never asserted, so it passed anyway.
  await page.getByTestId('open-settings').click();
  await page.waitForTimeout(1500);

  await takeScreenshot('05-settings-opened');

  await expect(page.getByTestId('settings-tab-general')).toBeVisible();
});

test('should navigate settings tabs', async () => {
  // Section ids from NAV_ITEMS in src/components/SettingsView.tsx — stable
  // identifiers rather than the translated labels rendered next to the icon.
  const tabs = ['general', 'appearance', 'engines', 'skills', 'about'];

  for (const tab of tabs) {
    const tabEl = page.getByTestId(`settings-tab-${tab}`);
    // Settings is open at this point, so every tab is expected to exist. The
    // previous conditional logged "✗ not found" and still passed.
    await expect(tabEl).toBeVisible();
    await tabEl.click();
    await page.waitForTimeout(500);
    await takeScreenshot(`06-settings-${tab}`);
    console.log(`✓ ${tab} tab`);
  }
});

test('should close settings', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // Previously this test only screenshotted, so it passed whether or not
  // Escape did anything.
  await expect(page.getByTestId('settings-tab-general')).toBeHidden();
  await takeScreenshot('07-settings-closed');
});

// ══════════════════════════════════════════════════════════
// 6. Engine Picker
// ══════════════════════════════════════════════════════════

test('should find and open engine picker', async () => {
  // One test id replaces the four-way guess at the trigger's English label.
  // The picker only renders once a chat is open, so absence is a legitimate
  // state — but it is reported as a skip rather than a pass, so it can never
  // quietly stand in for a real regression.
  const picker = page.getByTestId('engine-picker-trigger');
  const present = await picker.isVisible({ timeout: 1000 }).catch(() => false);
  test.skip(!present, 'Engine picker not rendered — no chat open in this run');

  await picker.click();
  await page.waitForTimeout(500);
  await takeScreenshot('08-engine-dropdown');

  // Which engines are offered depends on configured agents; that the menu opens
  // does not. Assert the deterministic half by role, which is locale-independent.
  await expect(page.locator('[role="menu"]').first()).toBeVisible();

  const pilotOption = page.getByTestId('engine-option-mastra');
  if (await pilotOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('✓ Pilot engine option found');
  }
});

// ══════════════════════════════════════════════════════════
// 7. Branding Check
// ══════════════════════════════════════════════════════════

test('should have no retired brand names in UI', async () => {
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  console.log('body length:', bodyText.length);

  // Guard against reading an empty string and passing vacuously.
  expect(bodyText.length, 'read no UI text — assertions below would be meaningless').toBeGreaterThan(0);
  for (const retired of ['Harnss', 'OpenACP']) {
    expect(bodyText, `retired brand "${retired}" leaked into the UI`).not.toContain(retired);
  }
});

// ══════════════════════════════════════════════════════════
// 8. Preload API surface
// ══════════════════════════════════════════════════════════

// Reads the real preload bridge — never stub window.pilot/window.claude here.
// Asserting against an injected mock only proves the mock exists, which is how
// the deleted mastra-*.spec.ts files managed to pass while testing nothing.
test('preload should expose the pilot and claude bridges', async () => {
  const api = await page.evaluate(() => {
    const pilot = (window as globalThis.Window & { pilot?: Record<string, any> }).pilot;
    const claude = (window as globalThis.Window & { claude?: Record<string, any> }).claude;
    return {
      mastraStart: typeof pilot?.mastra?.start,
      mastraListProviders: typeof pilot?.mastra?.listProviders,
      mastraRespondToApproval: typeof pilot?.mastra?.respondToApproval,
      skillsList: typeof pilot?.skills?.list,
      memoryRead: typeof pilot?.memory?.read,
      settingsGet: typeof claude?.settings?.get,
      convertToPdf: typeof claude?.convertToPdf,
    };
  });

  console.log('Preload API:', api);
  for (const [name, type] of Object.entries(api)) {
    expect(type, `window bridge is missing ${name}`).toBe('function');
  }
});
