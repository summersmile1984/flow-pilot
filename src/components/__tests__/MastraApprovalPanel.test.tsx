import { describe, it, expect, vi } from 'vitest';

// Mock pilot.mastra API
const mockRespondToApproval = vi.fn();
const mockSetToolPolicy = vi.fn();
const mockSetPermissionMode = vi.fn();

vi.stubGlobal('window', {
  pilot: {
    mastra: {
      respondToApproval: mockRespondToApproval,
      setToolPolicy: mockSetToolPolicy,
      setPermissionMode: mockSetPermissionMode,
    },
  },
});

describe('Mastra Approval IPC', () => {
  it('has respondToApproval API available', () => {
    expect(typeof window.pilot.mastra.respondToApproval).toBe('function');
  });

  it('has setToolPolicy API available', () => {
    expect(typeof window.pilot.mastra.setToolPolicy).toBe('function');
  });

  it('has setPermissionMode API available', () => {
    expect(typeof window.pilot.mastra.setPermissionMode).toBe('function');
  });

  it('calls respondToApproval with approve decision', async () => {
    mockRespondToApproval.mockResolvedValue({ success: true });

    const result = await window.pilot.mastra.respondToApproval({
      decision: 'approve',
      toolCallId: 'test-id',
    });
    expect(result.success).toBe(true);
    expect(mockRespondToApproval).toHaveBeenCalledWith({
      decision: 'approve',
      toolCallId: 'test-id',
    });
  });

  it('calls respondToApproval with decline decision', async () => {
    mockRespondToApproval.mockResolvedValue({ success: true });

    const result = await window.pilot.mastra.respondToApproval({
      decision: 'decline',
      toolCallId: 'test-id',
    });
    expect(result.success).toBe(true);
    expect(mockRespondToApproval).toHaveBeenCalledWith({
      decision: 'decline',
      toolCallId: 'test-id',
    });
  });

  it('calls setToolPolicy correctly', async () => {
    mockSetToolPolicy.mockResolvedValue({ success: true });

    const result = await window.pilot.mastra.setToolPolicy({
      toolName: 'bash',
      policy: 'allow',
    });
    expect(result.success).toBe(true);
    expect(mockSetToolPolicy).toHaveBeenCalledWith({
      toolName: 'bash',
      policy: 'allow',
    });
  });

  it('calls setPermissionMode with default mode', async () => {
    mockSetPermissionMode.mockResolvedValue({ success: true });

    const result = await window.pilot.mastra.setPermissionMode({
      mode: 'default',
    });
    expect(result.success).toBe(true);
    expect(mockSetPermissionMode).toHaveBeenCalledWith({
      mode: 'default',
    });
  });

  it('calls setPermissionMode with bypassPermissions mode', async () => {
    mockSetPermissionMode.mockResolvedValue({ success: true });

    const result = await window.pilot.mastra.setPermissionMode({
      mode: 'bypassPermissions',
    });
    expect(result.success).toBe(true);
    expect(mockSetPermissionMode).toHaveBeenCalledWith({
      mode: 'bypassPermissions',
    });
  });

  it('handles respondToApproval failure', async () => {
    mockRespondToApproval.mockResolvedValue({ success: false, error: 'Not initialized' });

    const result = await window.pilot.mastra.respondToApproval({
      decision: 'approve',
      toolCallId: 'test-id',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not initialized');
  });

  it('handles setToolPolicy failure', async () => {
    mockSetToolPolicy.mockResolvedValue({ success: false, error: 'Failed' });

    const result = await window.pilot.mastra.setToolPolicy({
      toolName: 'bash',
      policy: 'deny',
    });
    expect(result.success).toBe(false);
  });

  it('handles setPermissionMode failure', async () => {
    mockSetPermissionMode.mockResolvedValue({ success: false, error: 'Failed' });

    const result = await window.pilot.mastra.setPermissionMode({
      mode: 'default',
    });
    expect(result.success).toBe(false);
  });
});
