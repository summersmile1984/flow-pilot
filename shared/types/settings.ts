/**
 * Settings types shared between electron and renderer processes.
 *
 * Canonical definitions — import from here, never redefine.
 */

// ── Simple scalar types ──

export type PreferredEditor = "auto" | "cursor" | "code" | "zed";
export type VoiceDictationMode = "native" | "whisper";
export type ThemeOption = "light" | "dark" | "system";
/** UI language. "system" follows the OS locale; the rest are shipped locale bundles. */
export type LanguageOption = "system" | "en" | "zh-CN";
export type MacBackgroundEffect = "liquid-glass" | "vibrancy" | "off";
export type CodexBinarySource = "auto" | "managed" | "custom";
export type ClaudeBinarySource = "auto" | "managed" | "custom";

// ── Notification settings ──

export type NotificationTrigger = "always" | "unfocused" | "never";

export interface NotificationEventSettings {
  osNotification: NotificationTrigger;
  sound: NotificationTrigger;
}

export interface NotificationSettings {
  exitPlanMode: NotificationEventSettings;
  permissions: NotificationEventSettings;
  askUserQuestion: NotificationEventSettings;
  sessionComplete: NotificationEventSettings;
}

// ── Main AppSettings interface ──

/** Main-process app settings (persisted to JSON file in data dir). */
export interface AppSettings {
  /** Include pre-release versions when checking for updates */
  allowPrereleaseUpdates: boolean;
  /** Number of recent chats to show per project in the sidebar (default: 10) */
  defaultChatLimit: number;
  /** Preferred code editor for "Open in Editor" actions (default: "auto") */
  preferredEditor: PreferredEditor;
  /** Voice dictation mode: "native" uses OS dictation, "whisper" uses local AI model (default: "native") */
  voiceDictation: VoiceDictationMode;
  /** Per-event notification and sound configuration */
  notifications: NotificationSettings;
  /** Custom client name sent to Codex servers during handshake (default: "Harnss") */
  codexClientName: string;
  /** Which Codex binary source to use */
  codexBinarySource: CodexBinarySource;
  /** Absolute path used when codexBinarySource is custom */
  codexCustomBinaryPath: string;
  /** Which Claude binary source to use */
  claudeBinarySource: ClaudeBinarySource;
  /** Absolute path used when claudeBinarySource is custom */
  claudeCustomBinaryPath: string;
  /** Show developer-only "Dev Fill" button in chat title bar (local dev builds only) */
  showDevFillInChatTitleBar: boolean;
  /** Show the Jira board UI in the sidebar and main panel (developer preview) */
  showJiraBoard: boolean;
  /** Preferred native macOS background material when window transparency is enabled */
  macBackgroundEffect: MacBackgroundEffect;
  /** Pilot supervisor LLM: API key (overrides .env DEEPSEEK_API_KEY when set) */
  pilotSupervisorApiKey: string;
  /** Pilot supervisor LLM: custom base URL for an OpenAI-compatible endpoint */
  pilotSupervisorBaseUrl: string;
  /**
   * Default supervisor model for new Pilot chats, as a compound
   * `providerId::modelId`. Blank falls back to the first provider's first model.
   */
  pilotSupervisorModel: string;
  /**
   * Output-token cap for supervisor replies. Too low truncates mid-answer;
   * the ceiling is model-specific (deepseek-chat maxes at 8192).
   */
  pilotSupervisorMaxOutputTokens: number;
  /** Enable anonymous analytics to help improve the app (default: true) */
  analyticsEnabled: boolean;
  /** Anonymous user ID for analytics (auto-generated) */
  analyticsUserId?: string;
  /** Last date (YYYY-MM-DD) when daily_active_user was sent */
  analyticsLastDailyActiveDate?: string;
}
