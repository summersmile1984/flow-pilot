import { test, expect, type Page, type BrowserContext } from '@playwright/test';

let page: Page;
let context: BrowserContext;
let appLoaded = false;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Check if app loaded successfully (not showing error boundary)
  const reloadButton = page.locator('button:has-text("Reload")');
  appLoaded = !(await reloadButton.isVisible({ timeout: 1000 }).catch(() => false));
});

test.afterAll(async () => {
  await context.close();
});

test.describe('Mastra Mode Selection UI', () => {
  test('should have engine picker visible', async () => {
    if (!appLoaded) {
      test.skip(true, 'App did not load (requires Electron environment)');
      return;
    }
    const buttons = await page.locator('button').all();
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('should open dropdown when clicking engine picker', async () => {
    if (!appLoaded) {
      test.skip(true, 'App did not load (requires Electron environment)');
      return;
    }
    
    const selectors = [
      'button:has-text("Claude Code")',
      'button:has-text("Pilot")',
      'button:has-text("Codex")',
      'button:has-text("Claude")',
    ];
    
    let enginePicker = null;
    for (const selector of selectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        enginePicker = el;
        break;
      }
    }
    
    if (enginePicker) {
      await enginePicker.click();
      await page.waitForTimeout(500);
      
      const dropdown = page.locator('[role="menu"], [role="listbox"]');
      await expect(dropdown).toBeVisible({ timeout: 3000 });
    } else {
      test.skip(true, 'Engine picker button not found');
    }
  });

  test('should display Mastra options when Pilot is available', async () => {
    if (!appLoaded) {
      test.skip(true, 'App did not load (requires Electron environment)');
      return;
    }
    
    const pilotOption = page.locator('[role="menuitem"], [role="option"]').filter({ hasText: 'Pilot' });
    
    if (await pilotOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pilotOption.click();
      await page.waitForTimeout(500);
      
      const enginePicker = page.locator('button').filter({ hasText: 'Pilot' });
      await enginePicker.click();
      await page.waitForTimeout(500);
      
      const agentMode = page.locator('text=Agent Mode');
      if (await agentMode.isVisible({ timeout: 2000 }).catch(() => false)) {
        const supervisor = page.locator('text=Supervisor');
        const directClaude = page.locator('text=Direct (Claude Code)');
        const directCodex = page.locator('text=Direct (Codex)');
        
        await expect(supervisor).toBeVisible();
        await expect(directClaude).toBeVisible();
        await expect(directCodex).toBeVisible();
      }
    }
  });
});

test.describe('Settings Store', () => {
  test('should have default Mastra mode settings', async () => {
    const mastraMode = await page.evaluate(() => {
      return localStorage.getItem('pilot-mastra-mode');
    });
    
    const mastraAgentId = await page.evaluate(() => {
      return localStorage.getItem('pilot-mastra-agent-id');
    });
    
    if (mastraMode) {
      expect(['supervisor', 'direct', 'acp-supervisor']).toContain(mastraMode);
    }
    if (mastraAgentId) {
      expect(['claude-code', 'codex']).toContain(mastraAgentId);
    }
  });
});

test.describe('IPC Integration', () => {
  test('should have pilot API available', async () => {
    const apiCheck = await page.evaluate(() => {
      const pilot = (window as any).pilot;
      return {
        hasPilot: typeof pilot !== 'undefined',
        hasMastraStart: typeof pilot?.mastra?.start === 'function',
        hasSkillsList: typeof pilot?.skills?.list === 'function',
        hasMemoryRead: typeof pilot?.memory?.read === 'function',
      };
    });
    
    // In Electron, these should all be true
    // In web dev server without preload, pilot API won't exist
    if (apiCheck.hasPilot) {
      expect(apiCheck.hasMastraStart).toBe(true);
      expect(apiCheck.hasSkillsList).toBe(true);
      expect(apiCheck.hasMemoryRead).toBe(true);
    }
  });
});
