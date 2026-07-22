import { memo, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, MessageSquare, Code, Mic } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingRow, SettingsSelect, SettingsHeader, SettingsSection } from "@/components/settings/shared";
import type { AppSettings, PreferredEditor, VoiceDictationMode } from "@/types";

interface GeneralSettingsProps {
  appSettings: AppSettings | null;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

// ── Component ──

export const GeneralSettings = memo(function GeneralSettings({
  appSettings,
  onUpdateAppSettings,
}: GeneralSettingsProps) {
  // Local optimistic state — synced from props once loaded
  const { t } = useTranslation();
  const [allowPrerelease, setAllowPrerelease] = useState(false);
  const [chatLimit, setChatLimit] = useState(10);
  const [preferredEditor, setPreferredEditor] = useState<PreferredEditor>("auto");
  const [voiceDictation, setVoiceDictation] = useState<VoiceDictationMode>("native");

  useEffect(() => {
    if (appSettings) {
      setAllowPrerelease(appSettings.allowPrereleaseUpdates);
      setChatLimit(appSettings.defaultChatLimit || 10);
      setPreferredEditor(appSettings.preferredEditor || "auto");
      setVoiceDictation(appSettings.voiceDictation || "native");
    }
  }, [appSettings]);

  const handleTogglePrerelease = useCallback(
    async (checked: boolean) => {
      setAllowPrerelease(checked); // optimistic
      await onUpdateAppSettings({ allowPrereleaseUpdates: checked });
    },
    [onUpdateAppSettings],
  );

  const handleChatLimitChange = useCallback(
    async (value: number) => {
      const clamped = Math.max(5, Math.min(100, value));
      setChatLimit(clamped);
      await onUpdateAppSettings({ defaultChatLimit: clamped });
    },
    [onUpdateAppSettings],
  );

  const handleEditorChange = useCallback(
    async (value: PreferredEditor) => {
      setPreferredEditor(value); // optimistic
      await onUpdateAppSettings({ preferredEditor: value });
    },
    [onUpdateAppSettings],
  );

  const handleVoiceDictationChange = useCallback(
    async (value: VoiceDictationMode) => {
      setVoiceDictation(value); // optimistic
      await onUpdateAppSettings({ voiceDictation: value });
    },
    [onUpdateAppSettings],
  );

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader
        title={t("settings.general.title")}
        description={t("settings.general.description")}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-2">
          {/* ── Updates section ── */}
          <SettingsSection icon={Download} label={t("settings.general.section.updates")} first>
            <SettingRow
              label={t("settings.general.prerelease.label")}
              description={t("settings.general.prerelease.description")}
            >
              <Switch
                checked={allowPrerelease}
                onCheckedChange={handleTogglePrerelease}
              />
            </SettingRow>
          </SettingsSection>

          {/* ── Sidebar section ── */}
          <SettingsSection icon={MessageSquare} label={t("settings.general.section.sidebar")}>
            <SettingRow
              label={t("settings.general.chatLimit.label")}
              description={t("settings.general.chatLimit.description")}
            >
              <SettingsSelect
                value={String(chatLimit)}
                onValueChange={(v) => handleChatLimitChange(Number(v))}
                options={[5, 10, 15, 20, 25, 30, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </SettingRow>
          </SettingsSection>

          {/* ── Editor section ── */}
          <SettingsSection icon={Code} label={t("settings.general.section.editor")}>
            <SettingRow
              label={t("settings.general.editor.label")}
              description={t("settings.general.editor.description")}
            >
              <SettingsSelect
                value={preferredEditor}
                onValueChange={handleEditorChange}
                options={[
                  // Editor names are product names — never translated.
                  { value: "auto", label: t("settings.general.editor.auto") },
                  { value: "cursor", label: "Cursor" },
                  { value: "code", label: "VS Code" },
                  { value: "zed", label: "Zed" },
                ]}
              />
            </SettingRow>
          </SettingsSection>

          {/* ── Voice Dictation section ── */}
          <SettingsSection icon={Mic} label={t("settings.general.section.voiceDictation")}>
            <SettingRow
              label={t("settings.general.dictation.label")}
              description={t("settings.general.dictation.description")}
            >
              <SettingsSelect
                value={voiceDictation}
                onValueChange={handleVoiceDictationChange}
                options={[
                  { value: "native", label: t("settings.general.dictation.native") },
                  { value: "whisper", label: t("settings.general.dictation.whisper") },
                ]}
              />
            </SettingRow>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
});
