import { memo, useState, useCallback, useEffect } from "react";
import { Server, Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingRow, SettingsSelect, SettingsHeader, SettingsSection } from "@/components/settings/shared";
import type { AppSettings } from "@/types";

const INPUT_CLASS =
  "h-8 w-80 rounded-md border border-foreground/10 bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20";

interface EngineSettingsProps {
  appSettings: AppSettings | null;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

// ── Component ──

export const EngineSettings = memo(function EngineSettings({
  appSettings,
  onUpdateAppSettings,
}: EngineSettingsProps) {
  const [claudeBinarySource, setClaudeBinarySource] = useState<"auto" | "managed" | "custom">("auto");
  const [claudeCustomBinaryPath, setClaudeCustomBinaryPath] = useState("");
  const [codexBinarySource, setCodexBinarySource] = useState<"auto" | "managed" | "custom">("auto");
  const [codexCustomBinaryPath, setCodexCustomBinaryPath] = useState("");
  const [pilotApiKey, setPilotApiKey] = useState("");
  const [pilotBaseUrl, setPilotBaseUrl] = useState("");

  useEffect(() => {
    if (appSettings) {
      setClaudeBinarySource(appSettings.claudeBinarySource || "auto");
      setClaudeCustomBinaryPath(appSettings.claudeCustomBinaryPath || "");
      setCodexBinarySource(appSettings.codexBinarySource || "auto");
      setCodexCustomBinaryPath(appSettings.codexCustomBinaryPath || "");
      setPilotApiKey(appSettings.pilotSupervisorApiKey || "");
      setPilotBaseUrl(appSettings.pilotSupervisorBaseUrl || "");
    }
  }, [appSettings]);

  const handlePilotApiKeySave = useCallback(
    async (value: string) => {
      const next = value.trim();
      setPilotApiKey(next);
      await onUpdateAppSettings({ pilotSupervisorApiKey: next });
    },
    [onUpdateAppSettings],
  );

  const handlePilotBaseUrlSave = useCallback(
    async (value: string) => {
      const next = value.trim();
      setPilotBaseUrl(next);
      await onUpdateAppSettings({ pilotSupervisorBaseUrl: next });
    },
    [onUpdateAppSettings],
  );

  const handleClaudeBinarySourceChange = useCallback(
    async (source: "auto" | "managed" | "custom") => {
      setClaudeBinarySource(source);
      await onUpdateAppSettings({ claudeBinarySource: source });
    },
    [onUpdateAppSettings],
  );

  const handleClaudeCustomPathSave = useCallback(
    async (value: string) => {
      const next = value.trim();
      setClaudeCustomBinaryPath(next);
      await onUpdateAppSettings({ claudeCustomBinaryPath: next });
    },
    [onUpdateAppSettings],
  );

  const handleCodexBinarySourceChange = useCallback(
    async (source: "auto" | "managed" | "custom") => {
      setCodexBinarySource(source);
      await onUpdateAppSettings({ codexBinarySource: source });
    },
    [onUpdateAppSettings],
  );

  const handleCodexCustomPathSave = useCallback(
    async (value: string) => {
      const next = value.trim();
      setCodexCustomBinaryPath(next);
      await onUpdateAppSettings({ codexCustomBinaryPath: next });
    },
    [onUpdateAppSettings],
  );

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader
        title="Engines"
        description="Configure engine-level runtime behavior and binary selection"
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-2">
          <SettingsSection icon={Server} label="Claude Code" first>
            <SettingRow
              label="Claude binary source"
              description="Choose how Pilot resolves the Claude executable."
            >
              <SettingsSelect
                value={claudeBinarySource}
                onValueChange={handleClaudeBinarySourceChange}
                options={[
                  { value: "auto", label: "Auto detect" },
                  { value: "managed", label: "Managed install" },
                  { value: "custom", label: "Custom path" },
                ]}
                className="w-44"
              />
            </SettingRow>

            {claudeBinarySource === "custom" && (
              <SettingRow
                label="Custom Claude path"
                description="Absolute path to claude executable (claude or claude.exe)."
              >
                <input
                  type="text"
                  value={claudeCustomBinaryPath}
                  onChange={(e) => setClaudeCustomBinaryPath(e.target.value)}
                  onBlur={(e) => handleClaudeCustomPathSave(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleClaudeCustomPathSave(e.currentTarget.value);
                  }}
                  spellCheck={false}
                  className="h-8 w-80 rounded-md border border-foreground/10 bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20"
                  placeholder="Absolute path to claude executable"
                />
              </SettingRow>
            )}
          </SettingsSection>

          <SettingsSection icon={Server} label="Codex">
            <SettingRow
              label="Codex binary source"
              description="Choose how Pilot resolves the Codex executable."
            >
              <SettingsSelect
                value={codexBinarySource}
                onValueChange={handleCodexBinarySourceChange}
                options={[
                  { value: "auto", label: "Auto detect" },
                  { value: "managed", label: "Managed download" },
                  { value: "custom", label: "Custom path" },
                ]}
                className="w-44"
              />
            </SettingRow>

            {codexBinarySource === "custom" && (
              <SettingRow
                label="Custom Codex path"
                description="Absolute path to codex executable (codex or codex.exe)."
              >
                <input
                  type="text"
                  value={codexCustomBinaryPath}
                  onChange={(e) => setCodexCustomBinaryPath(e.target.value)}
                  onBlur={(e) => handleCodexCustomPathSave(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCodexCustomPathSave(e.currentTarget.value);
                  }}
                  spellCheck={false}
                  className={INPUT_CLASS}
                  placeholder="Absolute path to codex executable"
                />
              </SettingRow>
            )}
          </SettingsSection>

          <SettingsSection icon={Bot} label="Pilot supervisor (LLM)">
            <SettingRow
              label="API key"
              description="Key for the supervisor's LLM provider. Overrides the .env DEEPSEEK_API_KEY; leave blank to use it."
            >
              <input
                type="password"
                value={pilotApiKey}
                onChange={(e) => setPilotApiKey(e.target.value)}
                onBlur={(e) => handlePilotApiKeySave(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePilotApiKeySave(e.currentTarget.value);
                }}
                spellCheck={false}
                autoComplete="off"
                className={INPUT_CLASS}
                placeholder="sk-… (uses .env if blank)"
              />
            </SettingRow>

            <SettingRow
              label="Base URL"
              description="Optional. Custom OpenAI-compatible endpoint for the supervisor (e.g. a proxy). Leave blank for the provider default."
            >
              <input
                type="text"
                value={pilotBaseUrl}
                onChange={(e) => setPilotBaseUrl(e.target.value)}
                onBlur={(e) => handlePilotBaseUrlSave(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePilotBaseUrlSave(e.currentTarget.value);
                }}
                spellCheck={false}
                className={INPUT_CLASS}
                placeholder="https://api.deepseek.com"
              />
            </SettingRow>

            <p className="px-1 pt-1 text-xs text-muted-foreground">
              Model selection lives in the engine picker (Pilot → Supervisor model), configured via <code className="font-mono">.pilot/config.yaml</code>. Changes here rebuild active Pilot chats.
            </p>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
});
