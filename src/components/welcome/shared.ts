import type { InstalledAgent } from "@/types";

// ── Step definitions ──

export const WIZARD_STEPS = [
  "welcome",
  "appearance",
  "permissions",
  "project",
  "agents",
  "tour",
  "ready",
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number];

export const WELCOME_COMPLETED_KEY = "pilot-welcome-completed";

// ── Step props ──

export interface WizardStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export interface AppearanceStepProps extends WizardStepProps {
  glassSupported: boolean;
}

export interface PermissionsStepProps extends WizardStepProps {
  permissionMode: string;
  onPermissionModeChange: (mode: string) => void;
}

export interface ProjectStepProps extends WizardStepProps {
  onCreateProject: () => void;
  hasProjects: boolean;
}

export interface AgentsStepProps extends WizardStepProps {
  agents: InstalledAgent[];
  onSaveAgent: (agent: InstalledAgent) => Promise<{ ok?: boolean; error?: string }>;
  onDeleteAgent: (id: string) => Promise<{ ok?: boolean; error?: string }>;
}

export interface ReadyStepProps {
  permissionMode: string;
  onComplete: () => void;
}

// ── Permission mode data ──

// Ids and icons only. Labels come from `chat.permissionMode.<id>` (shared with
// the chat header, so the two never drift), descriptions from
// `welcome.permission.<id>` — both resolved at render, since anything held here
// would freeze at the boot language. `as const` is preserved because the `id`
// union is relied on downstream.
export const PERMISSION_MODES = [
  { id: "default", icon: "Shield" as const },
  { id: "acceptEdits", icon: "ShieldCheck" as const },
  { id: "bypassPermissions", icon: "ShieldOff" as const },
] as const;

// ── Animation ──

export const springTransition = {
  type: "spring" as const,
  damping: 30,
  stiffness: 300,
  mass: 0.8,
};

// ── Space color showcase data ──

export interface SpaceShowcase {
  /** Translation key suffix under `welcome.tour.space`. */
  id: string;
  emoji: string;
  hue: number;
  chroma: number;
}

export const SHOWCASE_SPACES: SpaceShowcase[] = [
  { id: "frontend", emoji: "🎨", hue: 260, chroma: 0.15 },
  { id: "api", emoji: "⚡", hue: 150, chroma: 0.15 },
  { id: "mobile", emoji: "📱", hue: 340, chroma: 0.15 },
  { id: "devops", emoji: "🚀", hue: 45, chroma: 0.15 },
];

// ── Tool panel showcase data ──

export interface ToolShowcase {
  /** Also the translation key suffix under `welcome.tour.tool`. */
  id: string;
  icon: string;
}

export const SHOWCASE_TOOLS: ToolShowcase[] = [
  { id: "terminal", icon: "Terminal" },
  { id: "git", icon: "GitBranch" },
  { id: "browser", icon: "Globe" },
  { id: "files", icon: "FileText" },
  { id: "project-files", icon: "FolderTree" },
];

/** Preview background for a space color swatch. */
export function getSpacePreviewBg(hue: number, chroma: number): string {
  const c = Math.min(chroma, 0.18);
  return `oklch(0.52 ${c} ${hue})`;
}
