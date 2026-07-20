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
  });
  
  // Get the first window
  page = await electronApp.firstWindow();
  
  // Wait for the app to be ready
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000); // Give app time to initialize
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Mastra Mode Selection', () => {
  test('should display engine picker dropdown', async () => {
    // Look for the engine picker button
    const enginePicker = page.locator('button:has-text("Claude Code"), button:has-text("Pilot")');
    await expect(enginePicker).toBeVisible({ timeout: 10000 });
  });

  test('should open engine picker dropdown', async () => {
    // Click the engine picker button
    const enginePicker = page.locator('button:has-text("Claude Code"), button:has-text("Pilot")');
    await enginePicker.click();
    
    // Wait for dropdown to appear
    await page.waitForTimeout(500);
    
    // Check that dropdown content is visible
    const dropdown = page.locator('[role="menu"]');
    await expect(dropdown).toBeVisible();
  });

  test('should display Mastra mode options when Pilot is selected', async () => {
    // First, select the Pilot engine if not already selected
    const pilotOption = page.locator('[role="menuitem"]:has-text("Pilot")');
    if (await pilotOption.isVisible()) {
      await pilotOption.click();
      await page.waitForTimeout(500);
    }
    
    // Re-open the dropdown
    const enginePicker = page.locator('button:has-text("Pilot")');
    await enginePicker.click();
    await page.waitForTimeout(500);
    
    // Check for Agent Mode section
    const agentModeLabel = page.locator('text=Agent Mode');
    await expect(agentModeLabel).toBeVisible({ timeout: 5000 });
    
    // Check for mode options
    const supervisorOption = page.locator('[role="menuitem"]:has-text("Supervisor")');
    const directClaudeOption = page.locator('[role="menuitem"]:has-text("Direct (Claude Code)")');
    const directCodexOption = page.locator('[role="menuitem"]:has-text("Direct (Codex)")');
    
    await expect(supervisorOption).toBeVisible();
    await expect(directClaudeOption).toBeVisible();
    await expect(directCodexOption).toBeVisible();
  });

  test('should select Supervisor mode', async () => {
    // Open dropdown
    const enginePicker = page.locator('button:has-text("Pilot")');
    await enginePicker.click();
    await page.waitForTimeout(500);
    
    // Click Supervisor option
    const supervisorOption = page.locator('[role="menuitem"]:has-text("Supervisor")');
    await supervisorOption.click();
    await page.waitForTimeout(500);
    
    // Check for success toast
    const toast = page.locator('text=Agent mode changed');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  test('should select Direct (Claude Code) mode', async () => {
    // Open dropdown
    const enginePicker = page.locator('button:has-text("Pilot")');
    await enginePicker.click();
    await page.waitForTimeout(500);
    
    // Click Direct (Claude Code) option
    const directClaudeOption = page.locator('[role="menuitem"]:has-text("Direct (Claude Code)")');
    await directClaudeOption.click();
    await page.waitForTimeout(500);
    
    // Check for success toast
    const toast = page.locator('text=Agent mode changed');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  test('should select Direct (Codex) mode', async () => {
    // Open dropdown
    const enginePicker = page.locator('button:has-text("Pilot")');
    await enginePicker.click();
    await page.waitForTimeout(500);
    
    // Click Direct (Codex) option
    const directCodexOption = page.locator('[role="menuitem"]:has-text("Direct (Codex)")');
    await directCodexOption.click();
    await page.waitForTimeout(500);
    
    // Check for success toast
    const toast = page.locator('text=Agent mode changed');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  test('should select ACP Supervisor (Claude) mode', async () => {
    // Open dropdown
    const enginePicker = page.locator('button:has-text("Pilot")');
    await enginePicker.click();
    await page.waitForTimeout(500);
    
    // Click ACP Supervisor (Claude) option
    const acpSupervisorClaudeOption = page.locator('[role="menuitem"]:has-text("ACP Supervisor (Claude)")');
    await acpSupervisorClaudeOption.click();
    await page.waitForTimeout(500);
    
    // Check for success toast
    const toast = page.locator('text=Agent mode changed');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  test('should select ACP Supervisor (Codex) mode', async () => {
    // Open dropdown
    const enginePicker = page.locator('button:has-text("Pilot")');
    await enginePicker.click();
    await page.waitForTimeout(500);
    
    // Click ACP Supervisor (Codex) option
    const acpSupervisorCodexOption = page.locator('[role="menuitem"]:has-text("ACP Supervisor (Codex)")');
    await acpSupervisorCodexOption.click();
    await page.waitForTimeout(500);
    
    // Check for success toast
    const toast = page.locator('text=Agent mode changed');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Mastra Session Creation', () => {
  test('should create a new session with Supervisor mode', async () => {
    // First select Supervisor mode
    const enginePicker = page.locator('button:has-text("Pilot")');
    await enginePicker.click();
    await page.waitForTimeout(500);
    
    const supervisorOption = page.locator('[role="menuitem"]:has-text("Supervisor")');
    await supervisorOption.click();
    await page.waitForTimeout(500);
    
    // Type a message and send
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('Hello, this is a test message');
    await page.waitForTimeout(300);
    
    // Press Enter or click send button
    await input.press('Enter');
    await page.waitForTimeout(2000);
    
    // Check that a session was created (look for session elements)
    // This is a basic check - actual session creation depends on Mastra backend
    const sessionIndicator = page.locator('text=Hello, this is a test message');
    await expect(sessionIndicator).toBeVisible({ timeout: 5000 });
  });
});
