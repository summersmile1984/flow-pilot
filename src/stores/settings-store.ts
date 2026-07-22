import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ToolId } from "@/types/tools";
import type { AcpPermissionBehavior, ClaudeEffort, EngineId, MacBackgroundEffect, ThemeOption } from "@/types";

// ── Constants ──

const DEFAULT_MODEL = "default";
const DEFAULT_PERMISSION_MODE = "default";
const DEFAULT_PLAN_MODE = true;
const DEFAULT_CLAUDE_EFFORT: ClaudeEffort = "high";
export const DEFAULT_ENGINE_MODELS: Record<EngineId, string> = {
  claude: DEFAULT_MODEL,
  acp: "",
  codex: "",
  mastra: "",
};

const MIN_RIGHT_PANEL = 200;
const MAX_RIGHT_PANEL = 500;
const DEFAULT_RIGHT_PANEL = 288;

const MIN_SPLIT = 0.2;
const MAX_SPLIT = 0.8;
const DEFAULT_SPLIT = 0.5;

const MIN_BOTTOM_HEIGHT = 120;
const MAX_BOTTOM_HEIGHT = 600;
const DEFAULT_BOTTOM_HEIGHT = 250;

const DEFAULT_TOOL_ORDER: ToolId[] = ["terminal", "git", "browser", "files", "project-files", "mcp"];
const VALID_TOOL_IDS = new Set<ToolId>([
  "terminal",
  "browser",
  "git",
  "files",
  "project-files",
  "tasks",
  "agents",
  "mcp",
]);

const IS_MAC_PLATFORM = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

const STORE_KEY = "pilot-settings-store";

// ── Shared helpers (also used by compat hook) ──

/** Normalize an array of ratios to sum to 1.0, respecting a per-element minimum. */
export function normalizeRatios(ratios: number[], count: number, min = 0.1): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  const equal = new Array<number>(count).fill(1 / count);
  if (ratios.length !== count) return equal;
  const clamped = ratios.map((r) => (Number.isFinite(r) ? Math.max(min, r) : min));
  const sum = clamped.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum === 0) return equal;
  return clamped.map((r) => r / sum);
}

// ── Types ──

/** Per-project settings keyed by projectId */
export interface ProjectSettings {
  /** Per-engine model selections (claude, acp, codex) */
  modelsByEngine: Record<EngineId, string>;
  /** Git working directory override */
  gitCwd: string | null;
  /** Active tool panels (serialized as array for persistence, exposed as Set) */
  activeTools: ToolId[];
  /** Display order of panel tools in the tools column */
  toolOrder: ToolId[];
  /** Right panel width in pixels */
  rightPanelWidth: number;
  /** Vertical split ratio between Tasks and Agents in the right panel (0.2-0.8) */
  rightSplitRatio: number;
  /** Collapsed repo paths in git panel */
  collapsedRepos: string[];
  /** Suppressed (auto-hidden) panel IDs */
  suppressedPanels: ToolId[];
  /** Tools placed in the bottom row instead of the right column */
  bottomTools: ToolId[];
  /** Bottom tools row height in pixels */
  bottomToolsHeight: number;
  /** Split ratios for bottom tools when multiple are active */
  bottomToolsSplitRatios: number[];
  /** Whether to group sidebar chats by git branch */
  organizeByChatBranch: boolean;
}

/** Global settings state (not per-project) */
interface GlobalSettingsState {
  theme: ThemeOption;
  islandLayout: boolean;
  islandShine: boolean;
  /** The native macOS background material (liquid-glass or vibrancy) — never "off" */
  macNativeBackgroundEffect: Exclude<MacBackgroundEffect, "off">;
  /** Whether transparency is enabled (combines with macNativeBackgroundEffect to derive macBackgroundEffect) */
  transparency: boolean;
  planMode: boolean;
  permissionMode: string;
  acpPermissionBehavior: AcpPermissionBehavior;
  thinking: boolean;
  claudeEffort: ClaudeEffort;
  autoGroupTools: boolean;
  avoidGroupingEdits: boolean;
  autoExpandTools: boolean;
  expandEditToolCallsByDefault: boolean;
  transparentToolPicker: boolean;
  coloredSidebarIcons: boolean;
  showToolIcons: boolean;
  coloredToolIcons: boolean;
  /** Mastra agent mode: supervisor (default), direct, or acp-supervisor */
  mastraMode: string;
  /** For direct/acp-supervisor modes: which ACP agent to use (e.g. opencode or codex) */
  mastraAgentId: string;
}

/** Actions (setters) — excluded from persistence via partialize */
interface SettingsActions {
  // Global setters
  setTheme: (t: ThemeOption) => void;
  setIslandLayout: (enabled: boolean) => void;
  setIslandShine: (enabled: boolean) => void;
  setMacBackgroundEffect: (effect: MacBackgroundEffect) => void;
  setTransparency: (enabled: boolean) => void;
  setPlanMode: (enabled: boolean) => void;
  setPermissionMode: (mode: string) => void;
  setAcpPermissionBehavior: (b: AcpPermissionBehavior) => void;
  setThinking: (on: boolean) => void;
  setClaudeEffort: (effort: ClaudeEffort) => void;
  setAutoGroupTools: (on: boolean) => void;
  setAvoidGroupingEdits: (on: boolean) => void;
  setAutoExpandTools: (on: boolean) => void;
  setExpandEditToolCallsByDefault: (on: boolean) => void;
  setTransparentToolPicker: (on: boolean) => void;
  setColoredSidebarIcons: (on: boolean) => void;
  setShowToolIcons: (on: boolean) => void;
  setColoredToolIcons: (on: boolean) => void;
  setMastraMode: (mode: string) => void;
  setMastraAgentId: (agentId: string) => void;

  // Per-project setters (all take projectId as first arg)
  setModelForEngine: (projectId: string, engine: EngineId, model: string) => void;
  setGitCwd: (projectId: string, path: string | null) => void;
  setActiveTools: (projectId: string, updater: ToolId[] | ((prev: ToolId[]) => ToolId[])) => void;
  setToolOrder: (projectId: string, updater: ToolId[] | ((prev: ToolId[]) => ToolId[])) => void;
  setRightPanelWidth: (projectId: string, width: number) => void;
  setRightSplitRatio: (projectId: string, ratio: number) => void;
  setCollapsedRepos: (projectId: string, updater: string[] | ((prev: string[]) => string[])) => void;
  toggleRepoCollapsed: (projectId: string, path: string) => void;
  setSuppressedPanels: (projectId: string, updater: ToolId[] | ((prev: ToolId[]) => ToolId[])) => void;
  suppressPanel: (projectId: string, id: ToolId) => void;
  unsuppressPanel: (projectId: string, id: ToolId) => void;
  setBottomTools: (projectId: string, updater: ToolId[] | ((prev: ToolId[]) => ToolId[])) => void;
  setBottomToolsHeight: (projectId: string, height: number) => void;
  setBottomToolsSplitRatios: (projectId: string, ratios: number[]) => void;
  setOrganizeByChatBranch: (projectId: string, on: boolean) => void;
}

export interface SettingsStore extends GlobalSettingsState, SettingsActions {
  /** Per-project settings map, keyed by projectId (or "__none__" for no project) */
  projects: Record<string, ProjectSettings>;
}

// ── Default project settings ──

/**
 * Stable module-level default — same reference every call.
 * CRITICAL: Zustand selectors return this for projects with no stored settings.
 * If this were a fresh object each time, useShallow would see "changed" references
 * for the array/object fields and trigger an infinite re-render loop.
 */
const DEFAULT_PROJECT_SETTINGS: ProjectSettings = Object.freeze({
  modelsByEngine: DEFAULT_ENGINE_MODELS,
  gitCwd: null,
  activeTools: [] as ToolId[],
  toolOrder: DEFAULT_TOOL_ORDER,
  rightPanelWidth: DEFAULT_RIGHT_PANEL,
  rightSplitRatio: DEFAULT_SPLIT,
  collapsedRepos: [] as string[],
  suppressedPanels: [] as ToolId[],
  bottomTools: [] as ToolId[],
  bottomToolsHeight: DEFAULT_BOTTOM_HEIGHT,
  bottomToolsSplitRatios: [] as number[],
  organizeByChatBranch: false,
});

/** Get project settings. Returns stable DEFAULT_PROJECT_SETTINGS reference when no project exists. */
function getProjectSettings(projects: Record<string, ProjectSettings>, projectId: string): ProjectSettings {
  const existing = projects[projectId];
  if (!existing) return DEFAULT_PROJECT_SETTINGS;
  return existing;
}

/** Immutably update a single project's settings */
function updateProject(
  projects: Record<string, ProjectSettings>,
  projectId: string,
  patch: Partial<ProjectSettings>,
): Record<string, ProjectSettings> {
  const current = getProjectSettings(projects, projectId);
  return { ...projects, [projectId]: { ...current, ...patch } };
}

// ── Legacy localStorage migration ──

/**
 * One-time migration: read all existing pilot-* localStorage keys into the
 * Zustand store shape. This runs only when the store key doesn't exist yet.
 */
function migrateFromLegacyLocalStorage(): { global: GlobalSettingsState; projects: Record<string, ProjectSettings> } {
  const global = readLegacyGlobalSettings();

  // Scan localStorage for all project-scoped keys to discover project IDs
  const projectIds = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("pilot-") || key === STORE_KEY) continue;

    // Global keys don't have a second segment that looks like a project ID.
    // Per-project keys follow the pattern: pilot-{projectId}-{setting}
    // We detect project keys by checking for known per-project suffixes.
    const perProjectSuffixes = [
      "-model-claude", "-model-acp", "-model-codex", "-model",
      "-git-cwd", "-active-tools", "-tool-order",
      "-right-panel-width", "-right-split",
      "-collapsed-repos", "-suppressed-panels",
      "-bottom-tools", "-bottom-tools-height", "-bottom-tools-split-ratios",
      "-organize-by-branch",
    ];

    for (const suffix of perProjectSuffixes) {
      if (key.endsWith(suffix)) {
        const pid = key.slice("pilot-".length, key.length - suffix.length);
        if (pid.length > 0) projectIds.add(pid);
        break;
      }
    }
  }

  const projects: Record<string, ProjectSettings> = {};
  for (const pid of projectIds) {
    projects[pid] = readLegacyProjectSettings(pid);
  }

  return { global, projects };
}

function readLegacyBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "true";
}

function readLegacyNumber(key: string, fallback: number, min: number, max: number): number {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function readLegacyJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function readLegacyGlobalSettings(): GlobalSettingsState {
  const themeRaw = localStorage.getItem("pilot-theme");
  const theme: ThemeOption = (themeRaw === "light" || themeRaw === "dark" || themeRaw === "system") ? themeRaw : "dark";

  // Plan mode with legacy migration
  let planMode = DEFAULT_PLAN_MODE;
  const storedPlanMode = localStorage.getItem("pilot-plan-mode");
  if (storedPlanMode !== null) {
    planMode = storedPlanMode === "true";
  } else {
    const legacyPermission = localStorage.getItem("pilot-permission-mode");
    if (legacyPermission === "plan") planMode = true;
  }

  // Permission mode with legacy migration
  const storedPermission = localStorage.getItem("pilot-permission-mode");
  const permissionMode = (!storedPermission || storedPermission === "plan") ? DEFAULT_PERMISSION_MODE : storedPermission;

  // ACP permission behavior
  const storedAcpBehavior = localStorage.getItem("pilot-acp-permission-behavior");
  const validAcpBehaviors: AcpPermissionBehavior[] = ["ask", "auto_accept", "allow_all"];
  const acpPermissionBehavior: AcpPermissionBehavior =
    storedAcpBehavior && validAcpBehaviors.includes(storedAcpBehavior as AcpPermissionBehavior)
      ? (storedAcpBehavior as AcpPermissionBehavior)
      : "ask";

  // Claude effort
  const storedEffort = localStorage.getItem("pilot-claude-effort");
  const claudeEffort: ClaudeEffort =
    (storedEffort === "low" || storedEffort === "medium" || storedEffort === "high" || storedEffort === "max")
      ? storedEffort
      : DEFAULT_CLAUDE_EFFORT;

  return {
    theme,
    islandLayout: readLegacyBool("pilot-island-layout", true),
    islandShine: readLegacyBool("pilot-island-shine", true),
    macNativeBackgroundEffect: "liquid-glass",
    transparency: readLegacyBool("pilot-transparency", true),
    planMode,
    permissionMode,
    acpPermissionBehavior,
    thinking: readLegacyBool("pilot-thinking", true),
    claudeEffort,
    autoGroupTools: readLegacyBool("pilot-auto-group-tools", true),
    avoidGroupingEdits: readLegacyBool("pilot-avoid-grouping-edits", false),
    autoExpandTools: readLegacyBool("pilot-auto-expand-tools", false),
    expandEditToolCallsByDefault: readLegacyBool("pilot-expand-edit-tool-calls-by-default", true),
    transparentToolPicker: readLegacyBool("pilot-transparent-tool-picker", false),
    coloredSidebarIcons: readLegacyBool("pilot-colored-sidebar-icons", true),
    showToolIcons: readLegacyBool("pilot-show-tool-icons", true),
    coloredToolIcons: readLegacyBool("pilot-colored-tool-icons", false),
    // The only live Pilot mode; retired legacy values (direct/acp-supervisor)
    // are intentionally not migrated
    mastraMode: "supervisor",
    mastraAgentId: localStorage.getItem("pilot-mastra-agent-id") || "opencode",
  };
}

function isCodexLikeModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return /^gpt[-\w.]*$/i.test(normalized) || /^o[0-9][\w.-]*$/i.test(normalized);
}

function readLegacyModelForEngine(pid: string, engine: EngineId): string {
  const byEngine = localStorage.getItem(`pilot-${pid}-model-${engine}`);
  if (byEngine && byEngine.trim().length > 0) return byEngine.trim();

  const legacy = localStorage.getItem(`pilot-${pid}-model`);
  if (!legacy || legacy.trim().length === 0) return DEFAULT_ENGINE_MODELS[engine];
  const legacyValue = legacy.trim();

  if (engine === "claude") {
    return isCodexLikeModel(legacyValue) ? DEFAULT_ENGINE_MODELS.claude : legacyValue;
  }
  if (engine === "codex") {
    return isCodexLikeModel(legacyValue) ? legacyValue : DEFAULT_ENGINE_MODELS.codex;
  }
  return DEFAULT_ENGINE_MODELS[engine];
}

function readLegacyToolOrder(pid: string): ToolId[] {
  const stored = readLegacyJson<ToolId[]>(`pilot-${pid}-tool-order`, []).filter((id) => VALID_TOOL_IDS.has(id));
  if (stored.length === 0) return [...DEFAULT_TOOL_ORDER];
  const set = new Set(stored);
  const result = [...stored];
  for (const id of DEFAULT_TOOL_ORDER) {
    if (!set.has(id)) result.push(id);
  }
  return result;
}

function readLegacyProjectSettings(pid: string): ProjectSettings {
  return {
    modelsByEngine: {
      claude: readLegacyModelForEngine(pid, "claude"),
      acp: readLegacyModelForEngine(pid, "acp"),
      codex: readLegacyModelForEngine(pid, "codex"),
      mastra: readLegacyModelForEngine(pid, "mastra"),
    },
    gitCwd: localStorage.getItem(`pilot-${pid}-git-cwd`),
    activeTools: readLegacyJson<ToolId[]>(`pilot-${pid}-active-tools`, []).filter((id) => VALID_TOOL_IDS.has(id)),
    toolOrder: readLegacyToolOrder(pid),
    rightPanelWidth: readLegacyNumber(`pilot-${pid}-right-panel-width`, DEFAULT_RIGHT_PANEL, MIN_RIGHT_PANEL, MAX_RIGHT_PANEL),
    rightSplitRatio: readLegacyNumber(`pilot-${pid}-right-split`, DEFAULT_SPLIT, MIN_SPLIT, MAX_SPLIT),
    collapsedRepos: readLegacyJson<string[]>(`pilot-${pid}-collapsed-repos`, []),
    suppressedPanels: readLegacyJson<ToolId[]>(`pilot-${pid}-suppressed-panels`, []),
    bottomTools: readLegacyJson<ToolId[]>(`pilot-${pid}-bottom-tools`, []).filter((id) => VALID_TOOL_IDS.has(id)),
    bottomToolsHeight: readLegacyNumber(`pilot-${pid}-bottom-tools-height`, DEFAULT_BOTTOM_HEIGHT, MIN_BOTTOM_HEIGHT, MAX_BOTTOM_HEIGHT),
    bottomToolsSplitRatios: readLegacyJson<number[]>(`pilot-${pid}-bottom-tools-split-ratios`, []),
    organizeByChatBranch: readLegacyBool(`pilot-${pid}-organize-by-branch`, false),
  };
}

// ── Side-effect: persist macBackgroundEffect to AppSettings ──

function persistMacBackgroundEffect(effect: Exclude<MacBackgroundEffect, "off">): void {
  if (!IS_MAC_PLATFORM || typeof window === "undefined" || !window.claude?.settings) return;
  void window.claude.settings.set({ macBackgroundEffect: effect });
}

// ── Validation helpers ──

function validateToolOrder(stored: ToolId[]): ToolId[] {
  const valid = stored.filter((id) => VALID_TOOL_IDS.has(id));
  if (valid.length === 0) return [...DEFAULT_TOOL_ORDER];
  const set = new Set(valid);
  const result = [...valid];
  for (const id of DEFAULT_TOOL_ORDER) {
    if (!set.has(id)) result.push(id);
  }
  return result;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function hasSameOrderedValues<T>(left: readonly T[], right: readonly T[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

// ── Store creation ──

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // ── Global state defaults ──
      theme: "dark",
      islandLayout: true,
      islandShine: true,
      macNativeBackgroundEffect: "liquid-glass",
      transparency: true,
      planMode: DEFAULT_PLAN_MODE,
      permissionMode: DEFAULT_PERMISSION_MODE,
      acpPermissionBehavior: "ask",
      thinking: true,
      claudeEffort: DEFAULT_CLAUDE_EFFORT,
      autoGroupTools: true,
      avoidGroupingEdits: false,
      autoExpandTools: false,
      expandEditToolCallsByDefault: true,
      transparentToolPicker: false,
      coloredSidebarIcons: true,
      showToolIcons: true,
      coloredToolIcons: false,
      mastraMode: "supervisor",
      mastraAgentId: "opencode",

      projects: {},

      // ── Global setters ──

      setTheme: (t) => set({ theme: t }),

      setIslandLayout: (enabled) => set({ islandLayout: enabled }),

      setIslandShine: (enabled) => set({ islandShine: enabled }),

      setMacBackgroundEffect: (effect) => {
        if (effect === "off") {
          set({ transparency: false });
          return;
        }
        set({ macNativeBackgroundEffect: effect, transparency: true });
        persistMacBackgroundEffect(effect);
      },

      setTransparency: (enabled) => {
        set({ transparency: enabled });
        if (IS_MAC_PLATFORM && enabled) {
          persistMacBackgroundEffect(get().macNativeBackgroundEffect);
        }
      },

      setPlanMode: (enabled) => set({ planMode: enabled }),

      setPermissionMode: (mode) => {
        // Legacy: treat "plan" as enabling the dedicated plan toggle
        if (mode === "plan") {
          set({ planMode: true, permissionMode: DEFAULT_PERMISSION_MODE });
          return;
        }
        set({ permissionMode: mode });
      },

      setAcpPermissionBehavior: (b) => set({ acpPermissionBehavior: b }),

      setThinking: (on) => set({ thinking: on }),

      setClaudeEffort: (effort) => set({ claudeEffort: effort }),

      setAutoGroupTools: (on) => set({ autoGroupTools: on }),

      setAvoidGroupingEdits: (on) => set({ avoidGroupingEdits: on }),

      setAutoExpandTools: (on) => set({ autoExpandTools: on }),

      setExpandEditToolCallsByDefault: (on) => set({ expandEditToolCallsByDefault: on }),

      setTransparentToolPicker: (on) => set({ transparentToolPicker: on }),

      setColoredSidebarIcons: (on) => set({ coloredSidebarIcons: on }),

      setShowToolIcons: (on) => set({ showToolIcons: on }),

      setColoredToolIcons: (on) => set({ coloredToolIcons: on }),

      setMastraMode: (mode) => set({ mastraMode: mode }),

      setMastraAgentId: (agentId) => set({ mastraAgentId: agentId }),

      // ── Per-project setters ──

      setModelForEngine: (projectId, engine, model) => {
        const normalized = model.trim();
        if (!normalized) return;
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        if (current.modelsByEngine[engine] === normalized) return;
        const nextModels = { ...current.modelsByEngine, [engine]: normalized };
        set({ projects: updateProject(projects, projectId, { modelsByEngine: nextModels }) });
      },

      setGitCwd: (projectId, path) => {
        const trimmed = path?.trim() || null;
        const { projects } = get();
        set({ projects: updateProject(projects, projectId, { gitCwd: trimmed }) });
      },

      setActiveTools: (projectId, updater) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        const next = typeof updater === "function" ? updater(current.activeTools) : updater;
        const valid = next.filter((id) => VALID_TOOL_IDS.has(id));
        if (hasSameOrderedValues(current.activeTools, valid)) return;
        set({ projects: updateProject(projects, projectId, { activeTools: valid }) });
      },

      setToolOrder: (projectId, updater) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        const next = typeof updater === "function" ? updater(current.toolOrder) : updater;
        set({ projects: updateProject(projects, projectId, { toolOrder: validateToolOrder(next) }) });
      },

      setRightPanelWidth: (projectId, width) => {
        const clamped = clampNumber(width, MIN_RIGHT_PANEL, MAX_RIGHT_PANEL, DEFAULT_RIGHT_PANEL);
        const { projects } = get();
        set({ projects: updateProject(projects, projectId, { rightPanelWidth: clamped }) });
      },

      setRightSplitRatio: (projectId, ratio) => {
        const clamped = clampNumber(ratio, MIN_SPLIT, MAX_SPLIT, DEFAULT_SPLIT);
        const { projects } = get();
        set({ projects: updateProject(projects, projectId, { rightSplitRatio: clamped }) });
      },

      setCollapsedRepos: (projectId, updater) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        const next = typeof updater === "function" ? updater(current.collapsedRepos) : updater;
        set({ projects: updateProject(projects, projectId, { collapsedRepos: next }) });
      },

      toggleRepoCollapsed: (projectId, path) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        const repos = current.collapsedRepos;
        const next = repos.includes(path) ? repos.filter((r) => r !== path) : [...repos, path];
        set({ projects: updateProject(projects, projectId, { collapsedRepos: next }) });
      },

      setSuppressedPanels: (projectId, updater) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        const next = typeof updater === "function" ? updater(current.suppressedPanels) : updater;
        set({ projects: updateProject(projects, projectId, { suppressedPanels: next }) });
      },

      suppressPanel: (projectId, id) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        if (current.suppressedPanels.includes(id)) return;
        set({ projects: updateProject(projects, projectId, { suppressedPanels: [...current.suppressedPanels, id] }) });
      },

      unsuppressPanel: (projectId, id) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        if (!current.suppressedPanels.includes(id)) return;
        set({ projects: updateProject(projects, projectId, { suppressedPanels: current.suppressedPanels.filter((p) => p !== id) }) });
      },

      setBottomTools: (projectId, updater) => {
        const { projects } = get();
        const current = getProjectSettings(projects, projectId);
        const next = typeof updater === "function" ? updater(current.bottomTools) : updater;
        const valid = next.filter((id) => VALID_TOOL_IDS.has(id));
        set({ projects: updateProject(projects, projectId, { bottomTools: valid }) });
      },

      setBottomToolsHeight: (projectId, height) => {
        const clamped = clampNumber(height, MIN_BOTTOM_HEIGHT, MAX_BOTTOM_HEIGHT, DEFAULT_BOTTOM_HEIGHT);
        const { projects } = get();
        set({ projects: updateProject(projects, projectId, { bottomToolsHeight: clamped }) });
      },

      setBottomToolsSplitRatios: (projectId, ratios) => {
        const { projects } = get();
        set({ projects: updateProject(projects, projectId, { bottomToolsSplitRatios: [...ratios] }) });
      },

      setOrganizeByChatBranch: (projectId, on) => {
        const { projects } = get();
        set({ projects: updateProject(projects, projectId, { organizeByChatBranch: on }) });
      },
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Global state
        theme: state.theme,
        islandLayout: state.islandLayout,
        islandShine: state.islandShine,
        macNativeBackgroundEffect: state.macNativeBackgroundEffect,
        transparency: state.transparency,
        planMode: state.planMode,
        permissionMode: state.permissionMode,
        acpPermissionBehavior: state.acpPermissionBehavior,
        thinking: state.thinking,
        claudeEffort: state.claudeEffort,
        autoGroupTools: state.autoGroupTools,
        avoidGroupingEdits: state.avoidGroupingEdits,
        autoExpandTools: state.autoExpandTools,
        expandEditToolCallsByDefault: state.expandEditToolCallsByDefault,
        transparentToolPicker: state.transparentToolPicker,
        coloredSidebarIcons: state.coloredSidebarIcons,
        showToolIcons: state.showToolIcons,
        coloredToolIcons: state.coloredToolIcons,
        mastraMode: state.mastraMode,
        mastraAgentId: state.mastraAgentId,
        // Per-project
        projects: state.projects,
      }),
      // Merge incoming persisted state with defaults (handles new fields added later)
      merge: (persisted, current) => {
        const incoming = persisted as Partial<SettingsStore> | undefined;
        if (!incoming) return current;
        return {
          ...current,
          ...incoming,
          // Ensure projects is always an object, never undefined
          projects: incoming.projects ?? current.projects,
          // "direct" and "acp-supervisor" are retired for new chats (solo
          // agents live in the Direct group; the lead modes were a relay in
          // front of one agent) — coerce stale settings back to supervisor
          mastraMode: incoming.mastraMode && incoming.mastraMode !== "supervisor"
            ? "supervisor"
            : (incoming.mastraMode ?? current.mastraMode),
        };
      },
    },
  ),
);

// ── Legacy migration bootstrap ──

/**
 * Call once at app startup (e.g., in main.tsx) to migrate from the old
 * scattered localStorage keys to the unified Zustand store.
 * No-op if the store key already exists.
 */
export function migrateSettingsIfNeeded(): void {
  // If the store already has data, skip migration
  if (localStorage.getItem(STORE_KEY)) return;

  const { global, projects } = migrateFromLegacyLocalStorage();

  // Hydrate the store with migrated data
  useSettingsStore.setState({
    ...global,
    projects,
  });
}

// ── Selector helpers (for efficient subscriptions) ──

/**
 * Select a specific project's settings from the store.
 * Returns defaults for projects that haven't been configured yet.
 */
export function selectProjectSettings(state: SettingsStore, projectId: string): ProjectSettings {
  return getProjectSettings(state.projects, projectId);
}

/** Derive macBackgroundEffect from transparency + macNativeBackgroundEffect */
export function deriveMacBackgroundEffect(state: Pick<GlobalSettingsState, "transparency" | "macNativeBackgroundEffect">): MacBackgroundEffect {
  if (!IS_MAC_PLATFORM) {
    return state.transparency ? "liquid-glass" : "off";
  }
  return state.transparency ? state.macNativeBackgroundEffect : "off";
}

// ── Consumer-facing shape ──

/**
 * The flat settings object components consume, assembled by `useSettingsCompat`
 * from this store. Project-scoped values are already resolved for the active
 * project, so consumers never pass a project id.
 */
export interface Settings {
  // Global
  theme: ThemeOption;
  setTheme: (t: ThemeOption) => void;
  islandLayout: boolean;
  setIslandLayout: (enabled: boolean) => void;
  islandShine: boolean;
  setIslandShine: (enabled: boolean) => void;
  macBackgroundEffect: MacBackgroundEffect;
  setMacBackgroundEffect: (effect: MacBackgroundEffect) => void;
  transparency: boolean;
  setTransparency: (enabled: boolean) => void;
  planMode: boolean;
  setPlanMode: (enabled: boolean) => void;
  permissionMode: string;
  setPermissionMode: (mode: string) => void;
  acpPermissionBehavior: AcpPermissionBehavior;
  setAcpPermissionBehavior: (b: AcpPermissionBehavior) => void;
  thinking: boolean;
  setThinking: (on: boolean) => void;
  claudeEffort: ClaudeEffort;
  setClaudeEffort: (effort: ClaudeEffort) => void;
  autoGroupTools: boolean;
  setAutoGroupTools: (on: boolean) => void;
  avoidGroupingEdits: boolean;
  setAvoidGroupingEdits: (on: boolean) => void;
  autoExpandTools: boolean;
  setAutoExpandTools: (on: boolean) => void;
  expandEditToolCallsByDefault: boolean;
  setExpandEditToolCallsByDefault: (on: boolean) => void;
  transparentToolPicker: boolean;
  setTransparentToolPicker: (on: boolean) => void;
  coloredSidebarIcons: boolean;
  setColoredSidebarIcons: (on: boolean) => void;
  showToolIcons: boolean;
  setShowToolIcons: (on: boolean) => void;
  coloredToolIcons: boolean;
  setColoredToolIcons: (on: boolean) => void;

  // Per-project
  model: string;
  setModel: (m: string) => void;
  getModelForEngine: (engine: EngineId) => string;
  setModelForEngine: (engine: EngineId, model: string) => void;
  gitCwd: string | null;
  setGitCwd: (path: string | null) => void;
  activeTools: Set<ToolId>;
  setActiveTools: (updater: Set<ToolId> | ((prev: Set<ToolId>) => Set<ToolId>)) => void;
  rightPanelWidth: number;
  setRightPanelWidth: (w: number) => void;
  saveRightPanelWidth: () => void;
  /** Display order of panel tools in the tools column */
  toolOrder: ToolId[];
  setToolOrder: (updater: ToolId[] | ((prev: ToolId[]) => ToolId[])) => void;
  /** Vertical split ratio between Tasks and Agents in the right panel (0.2–0.8) */
  rightSplitRatio: number;
  setRightSplitRatio: (r: number) => void;
  saveRightSplitRatio: () => void;
  collapsedRepos: Set<string>;
  toggleRepoCollapsed: (path: string) => void;
  suppressedPanels: Set<ToolId>;
  suppressPanel: (id: ToolId) => void;
  unsuppressPanel: (id: ToolId) => void;
  /** Tools placed in the bottom row instead of the right column */
  bottomTools: Set<ToolId>;
  bottomToolsHeight: number;
  setBottomToolsHeight: (h: number) => void;
  saveBottomToolsHeight: () => void;
  bottomToolsSplitRatios: number[];
  setBottomToolsSplitRatios: (r: number[]) => void;
  saveBottomToolsSplitRatios: () => void;
  /** Whether to group sidebar chats by git branch (per-project, default false). */
  organizeByChatBranch: boolean;
  setOrganizeByChatBranch: (on: boolean) => void;
  /** Mastra agent mode: supervisor (default), direct, or acp-supervisor */
  mastraMode: string;
  setMastraMode: (mode: string) => void;
  /** For direct/acp-supervisor modes: which ACP agent to use (e.g. opencode or codex) */
  mastraAgentId: string;
  setMastraAgentId: (agentId: string) => void;
}

