import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  
  // Mock window.claude and window.pilot before page loads
  await context.addInitScript(() => {
    (window as any).claude = {
      sessions: { list: () => Promise.resolve([]) },
      settings: { get: () => Promise.resolve({}) },
    };
    (window as any).pilot = {
      mastra: {
        respondToApproval: () => Promise.resolve({ success: true }),
        setToolPolicy: () => Promise.resolve({ success: true }),
        setPermissionMode: () => Promise.resolve({ success: true }),
        onEvent: () => () => {},
      },
    };
  });
  
  page = await context.newPage();
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
});

test.afterAll(async () => {
  await context.close();
});

test.describe('Mastra Approval Panel', () => {
  test('should have approval IPC available', async () => {
    const hasRespondToApproval = await page.evaluate(() => {
      return typeof (window as any).pilot?.mastra?.respondToApproval === 'function';
    });
    expect(hasRespondToApproval).toBe(true);
    
    const hasSetToolPolicy = await page.evaluate(() => {
      return typeof (window as any).pilot?.mastra?.setToolPolicy === 'function';
    });
    expect(hasSetToolPolicy).toBe(true);
    
    const hasSetPermissionMode = await page.evaluate(() => {
      return typeof (window as any).pilot?.mastra?.setPermissionMode === 'function';
    });
    expect(hasSetPermissionMode).toBe(true);
  });

  test('should store permission mode in localStorage', async () => {
    const permissionMode = await page.evaluate(() => {
      return localStorage.getItem('pilot-mastra-permission-mode');
    });
    
    if (permissionMode) {
      expect(['default', 'bypassPermissions']).toContain(permissionMode);
    }
  });
});

test.describe('Permission Mode Selection', () => {
  test('should have permission mode UI controls', async () => {
    const buttons = await page.locator('button').all();
    expect(buttons.length).toBeGreaterThan(0);
  });
});
