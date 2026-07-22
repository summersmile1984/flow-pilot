import { memo, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingRow, SettingsHeader, SettingsSection } from "@/components/settings/shared";
import { syncAnalyticsSettings } from "@/lib/analytics/posthog";
import type { AppSettings } from "@/types";

interface AnalyticsSettingsProps {
  appSettings: AppSettings | null;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

// ── Component ──

export const AnalyticsSettings = memo(function AnalyticsSettings({
  appSettings,
  onUpdateAppSettings,
}: AnalyticsSettingsProps) {
  const { t } = useTranslation();
  // Local optimistic state — synced from props once loaded
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (appSettings) {
      setAnalyticsEnabled(appSettings.analyticsEnabled ?? true);
      setUserId(appSettings.analyticsUserId ?? null);
    }
  }, [appSettings]);

  const handleToggleAnalytics = useCallback(
    async (checked: boolean) => {
      setAnalyticsEnabled(checked); // optimistic
      await onUpdateAppSettings({ analyticsEnabled: checked });
      // Sync renderer-side posthog-js opt-in/out state to match
      await syncAnalyticsSettings();
    },
    [onUpdateAppSettings],
  );

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader
        title={t("settings.analytics.title")}
        description={t("settings.analytics.description")}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-2">
          {/* ── Analytics section ── */}
          <SettingsSection icon={BarChart3} label={t("settings.analytics.section")} first>
            <SettingRow
              label={t("settings.analytics.toggle.label")}
              description={t("settings.analytics.toggle.description")}
            >
              <Switch
                checked={analyticsEnabled}
                onCheckedChange={handleToggleAnalytics}
              />
            </SettingRow>

            {/* Show user ID when analytics is enabled */}
            {analyticsEnabled && userId && (
              <div className="mt-4 rounded-md bg-foreground/[0.03] p-3">
                <p className="text-xs font-medium text-foreground">
                  {t("settings.analytics.userId.label")}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                  {userId}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("settings.analytics.userId.note")}
                </p>
              </div>
            )}
          </SettingsSection>

          {/* ── What we collect section ── */}
          <div className="border-t border-foreground/[0.04] py-3">
            <h3 className="mb-2 text-sm font-medium text-foreground">
              {t("settings.analytics.collectTitle")}
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {(["platform", "activeUsers", "featureUsage"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                  <span>{t(`settings.analytics.collect.${key}`)}</span>
                </li>
              ))}
            </ul>

            <h3 className="mb-2 mt-4 text-sm font-medium text-foreground">
              {t("settings.analytics.notCollectTitle")}
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {(["code", "paths", "personal", "credentials"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                  <span>{t(`settings.analytics.notCollect.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});
