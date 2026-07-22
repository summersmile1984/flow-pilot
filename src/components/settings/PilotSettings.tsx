import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Cpu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingRow, SettingsSelect, SettingsHeader, SettingsSection } from "@/components/settings/shared";
import { LlmProviderManager } from "./LlmProviderManager";
import type { LlmProvider } from "@shared/types/llm-provider";
import type { AppSettings } from "@/types";

/** Matches the ceiling the supervisor agent falls back to when unset. */
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const MIN_MAX_OUTPUT_TOKENS = 512;
const MAX_MAX_OUTPUT_TOKENS = 131072;

const INPUT_CLASS =
  "h-8 w-44 rounded-md border border-foreground/10 bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20";

interface PilotSettingsProps {
  appSettings: AppSettings | null;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

/**
 * Everything the Pilot supervisor runs on: which API providers it can reach,
 * which model new chats start on, and how long its replies may get. The
 * per-chat engine picker overrides the model; this is the default it falls
 * back to.
 */
export const PilotSettings = memo(function PilotSettings({
  appSettings,
  onUpdateAppSettings,
}: PilotSettingsProps) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [maxTokens, setMaxTokens] = useState(String(DEFAULT_MAX_OUTPUT_TOKENS));

  const reloadProviders = useCallback(async () => {
    const res = await window.pilot.mastra.listProviders();
    if (res?.success) setProviders(res.providers ?? []);
  }, []);

  useEffect(() => { void reloadProviders(); }, [reloadProviders]);

  useEffect(() => {
    if (appSettings) {
      setMaxTokens(String(appSettings.pilotSupervisorMaxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS));
    }
  }, [appSettings]);

  // Compound `providerId::modelId` — the same identity the engine picker uses.
  const modelOptions = useMemo(
    () => providers.flatMap((p) =>
      p.models.map((m) => ({ value: `${p.id}::${m}`, label: `${p.name} / ${m}` })),
    ),
    [providers],
  );

  // A saved default can name a provider or model that has since been removed;
  // fall back to the first option rather than showing a blank select.
  const selectedModel = useMemo(() => {
    const saved = appSettings?.pilotSupervisorModel ?? "";
    if (saved && modelOptions.some((o) => o.value === saved)) return saved;
    return modelOptions[0]?.value ?? "";
  }, [appSettings?.pilotSupervisorModel, modelOptions]);

  const handleModelChange = useCallback(
    async (value: string) => { await onUpdateAppSettings({ pilotSupervisorModel: value }); },
    [onUpdateAppSettings],
  );

  const handleMaxTokensSave = useCallback(
    async (raw: string) => {
      const parsed = Number.parseInt(raw, 10);
      const next = Number.isFinite(parsed)
        ? Math.min(MAX_MAX_OUTPUT_TOKENS, Math.max(MIN_MAX_OUTPUT_TOKENS, parsed))
        : DEFAULT_MAX_OUTPUT_TOKENS;
      setMaxTokens(String(next));
      await onUpdateAppSettings({ pilotSupervisorMaxOutputTokens: next });
    },
    [onUpdateAppSettings],
  );

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader
        title={t("settings.pilot.title")}
        description={t("settings.pilot.description")}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-2">
          <SettingsSection icon={Cpu} label={t("settings.pilot.section.supervisorModel")} first>
            <SettingRow
              label={t("settings.pilot.defaultModel.label")}
              description={
                modelOptions.length > 0
                  ? t("settings.pilot.defaultModel.descriptionReady")
                  : t("settings.pilot.defaultModel.descriptionEmpty")
              }
            >
              <SettingsSelect
                value={selectedModel}
                onValueChange={handleModelChange}
                options={modelOptions}
                className="w-64"
              />
            </SettingRow>

            <SettingRow
              label={t("settings.pilot.maxTokens.label")}
              description={t("settings.pilot.maxTokens.description")}
            >
              <input
                type="number"
                min={MIN_MAX_OUTPUT_TOKENS}
                max={MAX_MAX_OUTPUT_TOKENS}
                step={512}
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                onBlur={(e) => handleMaxTokensSave(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleMaxTokensSave(e.currentTarget.value);
                }}
                className={INPUT_CLASS}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection icon={Bot} label={t("settings.pilot.section.providers")}>
            <p className="px-1 pb-1 text-xs text-muted-foreground">
              {t("settings.pilot.providersIntro")}
            </p>
            <LlmProviderManager onProvidersChange={reloadProviders} />
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
});
