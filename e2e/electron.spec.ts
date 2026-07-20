import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 30000,
  });
  
  // Get the first window
  page = await electronApp.firstWindow();
  
  // Wait for app to be ready
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  
  // Dismiss welcome screen if present
  const skipButton = page.locator('button:has-text("Skip")');
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await page.waitForTimeout(1000);
  }
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test('should launch Electron app', async () => {
  // App should have loaded
  const title = await page.title();
  expect(title).toBeTruthy();
});

test('should have buttons visible', async () => {
  const buttons = await page.locator('button').all();
  expect(buttons.length).toBeGreaterThan(0);
});

test('should have pilot API available', async () => {
  const apiCheck = await page.evaluate(() => {
    const pilot = (window as any).pilot;
    return {
      hasPilot: typeof pilot !== 'undefined',
      hasMastra: typeof pilot?.mastra !== 'undefined',
      hasSkills: typeof pilot?.skills !== 'undefined',
      hasMemory: typeof pilot?.memory !== 'undefined',
    };
  });
  
  expect(apiCheck.hasPilot).toBe(true);
  expect(apiCheck.hasMastra).toBe(true);
  expect(apiCheck.hasSkills).toBe(true);
  expect(apiCheck.hasMemory).toBe(true);
});
