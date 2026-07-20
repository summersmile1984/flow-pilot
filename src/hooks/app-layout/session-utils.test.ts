import { describe, it, expect } from "vitest";
import { buildSessionOptions } from "./session-utils";

describe("buildSessionOptions", () => {
  const mockGetModelForEngine = (engine: string) => {
    const models: Record<string, string> = {
      claude: "claude-sonnet-4",
      codex: "o3",
      mastra: "deepseek/deepseek-chat",
    };
    return models[engine] ?? null;
  };

  const mockGetClaudeEffortForModel = (_model: string | undefined) => "high" as const;

  it("returns basic options for claude engine", () => {
    const result = buildSessionOptions(
      "claude",
      mockGetModelForEngine,
      "default",
      false,
      true,
      mockGetClaudeEffortForModel,
      null,
    );

    expect(result.engine).toBe("claude");
    expect(result.model).toBe("claude-sonnet-4");
    expect(result.permissionMode).toBe("default");
    expect(result.planMode).toBe(false);
    expect(result.thinkingEnabled).toBe(true);
    expect(result.effort).toBe("high");
    expect(result.mastraMode).toBeUndefined();
    expect(result.mastraAgentId).toBeUndefined();
  });

  it("returns mastra options when engine is mastra and mastraMode is provided", () => {
    const result = buildSessionOptions(
      "mastra",
      mockGetModelForEngine,
      "default",
      false,
      true,
      mockGetClaudeEffortForModel,
      null,
      "supervisor",
    );

    expect(result.engine).toBe("mastra");
    expect(result.model).toBe("deepseek/deepseek-chat");
    expect(result.mastraMode).toBe("supervisor");
    expect(result.mastraAgentId).toBeUndefined();
  });

  it("returns mastra options with direct mode and agentId", () => {
    const result = buildSessionOptions(
      "mastra",
      mockGetModelForEngine,
      "default",
      false,
      true,
      mockGetClaudeEffortForModel,
      null,
      "direct",
      "claude-code",
    );

    expect(result.engine).toBe("mastra");
    expect(result.mastraMode).toBe("direct");
    expect(result.mastraAgentId).toBe("claude-code");
  });

  it("returns mastra options with acp-supervisor mode and agentId", () => {
    const result = buildSessionOptions(
      "mastra",
      mockGetModelForEngine,
      "default",
      false,
      true,
      mockGetClaudeEffortForModel,
      null,
      "acp-supervisor",
      "codex",
    );

    expect(result.engine).toBe("mastra");
    expect(result.mastraMode).toBe("acp-supervisor");
    expect(result.mastraAgentId).toBe("codex");
  });

  it("does not include mastraMode when engine is not mastra", () => {
    const result = buildSessionOptions(
      "claude",
      mockGetModelForEngine,
      "default",
      false,
      true,
      mockGetClaudeEffortForModel,
      null,
      "supervisor",
      "claude-code",
    );

    expect(result.engine).toBe("claude");
    expect(result.mastraMode).toBeUndefined();
    expect(result.mastraAgentId).toBeUndefined();
  });

  it("does not include mastraMode when mastraMode is not provided", () => {
    const result = buildSessionOptions(
      "mastra",
      mockGetModelForEngine,
      "default",
      false,
      true,
      mockGetClaudeEffortForModel,
      null,
    );

    expect(result.engine).toBe("mastra");
    expect(result.mastraMode).toBeUndefined();
    expect(result.mastraAgentId).toBeUndefined();
  });
});
