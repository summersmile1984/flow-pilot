import {
  Terminal,
  FileText,
  FileEdit,
  Search,
  FolderSearch,
  Globe,
  Bot,
  Wrench,
  ListChecks,
  Lightbulb,
  Map,
  MessageCircleQuestion,
  PackageSearch,
  Sparkles,
} from "lucide-react";

// ── Tool icons ──

export const TOOL_ICONS: Record<string, typeof Terminal> = {
  Bash: Terminal,
  Read: FileText,
  Write: FileEdit,
  Edit: FileEdit,
  Grep: Search,
  Glob: FolderSearch,
  WebSearch: Globe,
  WebFetch: Globe,
  Task: Bot,
  Think: Lightbulb,
  TodoWrite: ListChecks,
  EnterPlanMode: Lightbulb,
  ExitPlanMode: Map,
  AskUserQuestion: MessageCircleQuestion,
  ToolSearch: PackageSearch,
  Skill: Sparkles,
};

export function getToolIcon(toolName: string) {
  return TOOL_ICONS[toolName] ?? Wrench;
}

// ── Tool labels ──

/**
 * "failed" resolves to a COMPLETE sentence ("Failed to run command"), not a bare
 * verb. The old shape stored English verb forms — past participle / present
 * participle / infinitive — and callers built `Failed to ${verb}` by hand. That
 * only works for English: Chinese has no verb morphology to hang the pattern on.
 */
export type ToolLabelType = "past" | "active" | "failed";

/** A translation key plus any interpolation it needs, resolved by the caller. */
export interface ToolLabelRef {
  key: string;
  params?: Record<string, string>;
}

/** Native tools that have their own phrasing, keyed by `tool.native.<name>`. */
const NATIVE_TOOL_NAMES = new Set([
  "Bash", "Read", "Write", "Edit", "Grep", "Glob", "WebSearch", "WebFetch",
  "TodoWrite", "Think", "EnterPlanMode", "ExitPlanMode", "AskUserQuestion",
  "ToolSearch", "Skill",
]);

// MCP tool friendly names — pattern-matched for different server name prefixes.
// Only the id lives here; the copy is in `tool.mcp.<id>` in the locale bundles.
export const MCP_TOOL_LABELS: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /searchJiraIssuesUsingJql$/, id: "jiraSearch" },
  { pattern: /getJiraIssue$/, id: "jiraGetIssue" },
  { pattern: /getVisibleJiraProjects$/, id: "jiraListProjects" },
  { pattern: /createJiraIssue$/, id: "jiraCreateIssue" },
  { pattern: /editJiraIssue$/, id: "jiraEditIssue" },
  { pattern: /transitionJiraIssue$/, id: "jiraTransitionIssue" },
  { pattern: /addCommentToJiraIssue$/, id: "jiraAddComment" },
  { pattern: /getTransitionsForJiraIssue$/, id: "jiraGetTransitions" },
  { pattern: /lookupJiraAccountId$/, id: "jiraLookupUser" },
  { pattern: /getConfluencePage$/, id: "confluenceGetPage" },
  { pattern: /searchConfluenceUsingCql$/, id: "confluenceSearch" },
  { pattern: /getConfluenceSpaces$/, id: "confluenceListSpaces" },
  { pattern: /getConfluencePageDescendants$/, id: "confluenceListDescendants" },
  { pattern: /getPagesInConfluenceSpace$/, id: "confluenceListPages" },
  { pattern: /createConfluencePage$/, id: "confluenceCreatePage" },
  { pattern: /updateConfluencePage$/, id: "confluenceUpdatePage" },
  { pattern: /getAccessibleAtlassianResources$/, id: "atlassianResources" },
  { pattern: /atlassianUserInfo$/, id: "atlassianUserInfo" },
  { pattern: /Atlassian[/_]+search$/, id: "atlassianSearch" },
  { pattern: /Atlassian[/_]+fetch$/, id: "atlassianFetch" },
  // Context7
  { pattern: /resolve-library-id$/, id: "context7ResolveLibrary" },
  { pattern: /query-docs$/, id: "context7QueryDocs" },
];

/** Server name for the generic "Called <server>" fallback, or null if not MCP-shaped. */
function mcpServerName(toolName: string): string | null {
  if (toolName.startsWith("mcp__")) return toolName.split("__")[1] ?? "MCP";
  if (toolName.startsWith("Tool: ")) return toolName.slice(6).split("/")[0] ?? "MCP";
  return null;
}

export function getMcpToolLabel(toolName: string, type: ToolLabelType): ToolLabelRef | null {
  for (const { pattern, id } of MCP_TOOL_LABELS) {
    if (pattern.test(toolName)) return { key: `tool.mcp.${id}.${type}` };
  }
  const server = mcpServerName(toolName);
  if (server) {
    const key = type === "past" ? "calledServer" : type === "active" ? "callingServer" : "failedCallServer";
    return { key: `tool.fallback.${key}`, params: { server } };
  }
  return null;
}

/**
 * Resolve a tool name to a translation key. Kept free of `t` so it stays a pure,
 * testable mapping — use `toolLabel()` when you have a `t` in hand.
 */
export function getToolLabel(toolName: string, type: ToolLabelType): ToolLabelRef | null {
  if (!toolName) return type === "failed" ? { key: "tool.fallback.failedGeneric" } : null;

  if (NATIVE_TOOL_NAMES.has(toolName)) return { key: `tool.native.${toolName}.${type}` };

  const mcp = getMcpToolLabel(toolName, type);
  if (mcp) return mcp;

  return type === "failed"
    ? { key: "tool.fallback.failedNamed", params: { tool: toolName } }
    : null;
}

/** `getToolLabel` with the key already resolved against the active language. */
export function toolLabel(
  t: (key: string, params?: Record<string, string>) => string,
  toolName: string,
  type: ToolLabelType,
): string | null {
  const ref = getToolLabel(toolName, type);
  return ref ? t(ref.key, ref.params) : null;
}

// ── Tool colors ──

export const TOOL_COLORS: Record<string, string> = {
  Bash: "text-[#6ee7b7]",
  Read: "text-[#67e8f9]",
  Write: "text-[#fb923c]",
  Edit: "text-[#fb923c]",
  NotebookEdit: "text-[#fb923c]",
  Grep: "text-[#a78bfa]",
  Glob: "text-[#a78bfa]",
  WebSearch: "text-[#22d3ee]",
  WebFetch: "text-[#22d3ee]",
  Task: "text-[#38bdf8]",
  Think: "text-[#fde68a]",
  TodoWrite: "text-[#34d399]",
  Skill: "text-[#f0abfc]",
  ToolSearch: "text-[#818cf8]",
};

export function getToolColor(toolName: string): string {
  return TOOL_COLORS[toolName] ?? "text-foreground/40";
}
