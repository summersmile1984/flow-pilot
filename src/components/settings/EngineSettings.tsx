import { memo, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Server } from "lucide-react";
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
  const { t } = useTranslation();
  const [claudeBinarySource, setClaudeBinarySource] = useState<"auto" | "managed" | "custom">("auto");
  const [claudeCustomBinaryPath, setClaudeCustomBinaryPath] = useState("");
  const [codexBinarySource, setCodexBinarySource] = useState<"auto" | "managed" | "custom">("auto");
  const [codexCustomBinaryPath, setCodexCustomBinaryPath] = useState("");
  useEffect(() => {
    if (appSettings) {
      setClaudeBinarySource(appSettings.claudeBinarySource || "auto");
      setClaudeCustomBinaryPath(appSettings.claudeCustomBinaryPath || "");
      setCodexBinarySource(appSettings.codexBinarySource || "auto");
      setCodexCustomBinaryPath(appSettings.codexCustomBinaryPath || "");
    }
  }, [appSettings]);

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
        title={t("settings.engines.title")}
        description={t("settings.engines.description")}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-2">
          {/* "Claude Code" is a product name — not translated. */}
          <SettingsSection icon={Server} label="Claude Code" first>
            <SettingRow
              label={t("settings.engines.claude.sourceLabel")}
              description={t("settings.engines.claude.sourceDescription")}
            >
              <SettingsSelect
                value={claudeBinarySource}
                onValueChange={handleClaudeBinarySourceChange}
                options={[
                  { value: "auto", label: t("settings.engines.binarySource.auto") },
                  { value: "managed", label: t("settings.engines.binarySource.managedInstall") },
                  { value: "custom", label: t("settings.engines.binarySource.custom") },
                ]}
                className="w-44"
              />
            </SettingRow>

            {claudeBinarySource === "custom" && (
              <SettingRow
                label={t("settings.engines.claude.pathLabel")}
                description={t("settings.engines.claude.pathDescription")}
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
                  placeholder={t("settings.engines.claude.pathPlaceholder")}
                />
              </SettingRow>
            )}
          </SettingsSection>

          <SettingsSection icon={Server} label="Codex">
            <SettingRow
              label={t("settings.engines.codex.sourceLabel")}
              description={t("settings.engines.codex.sourceDescription")}
            >
              <SettingsSelect
                value={codexBinarySource}
                onValueChange={handleCodexBinarySourceChange}
                options={[
                  { value: "auto", label: t("settings.engines.binarySource.auto") },
                  { value: "managed", label: t("settings.engines.binarySource.managedDownload") },
                  { value: "custom", label: t("settings.engines.binarySource.custom") },
                ]}
                className="w-44"
              />
            </SettingRow>

            {codexBinarySource === "custom" && (
              <SettingRow
                label={t("settings.engines.codex.pathLabel")}
                description={t("settings.engines.codex.pathDescription")}
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
                  placeholder={t("settings.engines.codex.pathPlaceholder")}
                />
              </SettingRow>
            )}
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
});
