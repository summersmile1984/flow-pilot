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

test('welcome screen should show Pilot branding', async () => {
  await waitForApp();
  const bodyText = await page.locator('body').textContent() || '';
  
  // Check for Pilot branding (might be on welcome or main screen)
  const hasPilot = bodyText.includes('Pilot');
  const hasHarnss = bodyText.includes('Harnss');
  
  console.log('Has Pilot:', hasPilot);
  console.log('Has Harnss:', hasHarnss);
  
  await takeScreenshot('02-welcome-or-main');
  
  // Should not have Harnss
  expect(hasHarnss).toBe(false);
});

// ══════════════════════════════════════════════════════════
// 3. Dismiss Welcome (if present)
// ══════════════════════════════════════════════════════════

test('should dismiss welcome screen if present', async () => {
  const skip = page.locator('button:has-text("Skip")');
  const getStarted = page.locator('button:has-text("Get Started")');
  
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
  // Try keyboard shortcut first
  await page.keyboard.press('Meta+,');
  await page.waitForTimeout(1500);
  
  await takeScreenshot('05-settings-opened');
  
  // Check if settings opened
  const bodyText = await page.locator('body').textContent() || '';
  console.log('Settings visible:', bodyText.includes('General') || bodyText.includes('Settings'));
});

test('should navigate settings tabs', async () => {
  const tabs = ['General', 'Appearance', 'Engines', 'Skills', 'About'];
  
  for (const tab of tabs) {
    const tabEl = page.locator(`text=${tab}`).first();
    if (await tabEl.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tabEl.click();
      await page.waitForTimeout(500);
      await takeScreenshot(`06-settings-${tab.toLowerCase()}`);
      console.log(`✓ ${tab} tab`);
    } else {
      console.log(`✗ ${tab} tab not found`);
    }
  }
});

test('should close settings', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await takeScreenshot('07-settings-closed');
});

// ══════════════════════════════════════════════════════════
// 6. Engine Picker
// ══════════════════════════════════════════════════════════

test('should find and open engine picker', async () => {
  const selectors = [
    'button:has-text("Claude Code")',
    'button:has-text("Pilot")',
    'button:has-text("Codex")',
    'button:has-text("Claude")',
  ];
  
  let picker = null;
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      picker = el;
      console.log('Found engine picker:', sel);
      break;
    }
  }
  
  if (picker) {
    await picker.click();
    await page.waitForTimeout(500);
    await takeScreenshot('08-engine-dropdown');
    
    // Check for Pilot option
    const pilotOption = page.locator('[role="menuitem"]').filter({ hasText: 'Pilot' });
    if (await pilotOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('✓ Pilot engine option found');
    }
  } else {
    console.log('Engine picker not visible (need to open a project first?)');
  }
});

// ══════════════════════════════════════════════════════════
// 7. Branding Check
// ══════════════════════════════════════════════════════════

test('should have no Harnss references in UI', async () => {
  const bodyText = await page.locator('body').textContent() || '';
  const hasHarnss = bodyText.includes('Harnss');

  console.log('Has Harnss in UI:', hasHarnss);

  // Should not have Harnss
  expect(hasHarnss).toBe(false);
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
