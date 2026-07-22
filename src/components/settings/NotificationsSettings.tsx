import { memo, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Volume2, MonitorSmartphone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingRow, SettingsSelect, SettingsHeader, SettingsSection } from "@/components/settings/shared";
import type {
  NotificationTrigger,
  NotificationEventSettings,
  NotificationSettings,
  AppSettings,
} from "@/types";

// ── Props ──

interface NotificationsSettingsProps {
  appSettings: AppSettings | null;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

// ── Event types and trigger values ──
//
// Ids only — both lists are evaluated once at import, so any label held here
// would be stuck at the boot language. Copy lives in the locale bundles under
// `settings.notifications.event.<key>` and `.trigger.<value>`, resolved at render.

const EVENT_KEYS: Array<keyof NotificationSettings> = [
  "sessionComplete",
  "exitPlanMode",
  "permissions",
  "askUserQuestion",
];

const TRIGGER_VALUES: NotificationTrigger[] = ["always", "unfocused", "never"];

// ── Component ──

export const NotificationsSettings = memo(function NotificationsSettings({
  appSettings,
  onUpdateAppSettings,
}: NotificationsSettingsProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSettings>({
    exitPlanMode: { osNotification: "unfocused", sound: "always" },
    permissions: { osNotification: "unfocused", sound: "unfocused" },
    askUserQuestion: { osNotification: "unfocused", sound: "always" },
    sessionComplete: { osNotification: "unfocused", sound: "always" },
  });

  // Sync from loaded AppSettings
  useEffect(() => {
    if (appSettings?.notifications) {
      setSettings(appSettings.notifications);
    }
  }, [appSettings]);

  const updateEventSetting = useCallback(
    async (
      eventKey: keyof NotificationSettings,
      field: keyof NotificationEventSettings,
      value: NotificationTrigger,
    ) => {
      const updated: NotificationSettings = {
        ...settings,
        [eventKey]: { ...settings[eventKey], [field]: value },
      };
      setSettings(updated); // optimistic
      await onUpdateAppSettings({ notifications: updated });
    },
    [settings, onUpdateAppSettings],
  );

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader
        title={t("settings.notifications.title")}
        description={t("settings.notifications.description")}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-2">
          {EVENT_KEYS.map((eventKey, i) => {
            const triggerOptions = TRIGGER_VALUES.map((value) => ({
              value,
              label: t(`settings.notifications.trigger.${value}`),
            }));
            return (
            <SettingsSection
              key={eventKey}
              icon={Bell}
              label={t(`settings.notifications.event.${eventKey}.label`)}
              first={i === 0}
            >
              <p className="mb-2 text-xs text-muted-foreground">
                {t(`settings.notifications.event.${eventKey}.description`)}
              </p>

              {/* Two setting rows per event: OS notification + sound */}
              <div className="flex flex-col">
                <SettingRow label={t("settings.notifications.osNotification")}>
                  <div className="flex items-center gap-1.5">
                    <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <SettingsSelect
                      value={settings[eventKey].osNotification}
                      onValueChange={(v) =>
                        updateEventSetting(eventKey, "osNotification", v)
                      }
                      options={triggerOptions}
                    />
                  </div>
                </SettingRow>

                <SettingRow label={t("settings.notifications.sound")}>
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <SettingsSelect
                      value={settings[eventKey].sound}
                      onValueChange={(v) =>
                        updateEventSetting(eventKey, "sound", v)
                      }
                      options={triggerOptions}
                    />
                  </div>
                </SettingRow>
              </div>
            </SettingsSection>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
});
