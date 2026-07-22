import { useTranslation } from "react-i18next";
import { Plug, PanelRight, FolderOpen, Activity } from "lucide-react";

export function McpSettings() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/30">
          <Plug className="h-7 w-7 text-foreground/80" />
        </div>
        <h2 className="mt-1 text-xl font-semibold text-foreground">{t("settings.mcp.title")}</h2>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {t("settings.mcp.managedFromPrefix")}{" "}
          <Plug className="inline h-3.5 w-3.5 -translate-y-px text-foreground/70" />{" "}
          <span className="font-medium text-foreground">{t("settings.mcp.panelName")}</span>{" "}
          {t("settings.mcp.managedFromSuffix")}
        </p>

        <div className="mt-4 w-full space-y-3 rounded-xl border border-border/50 bg-muted/20 px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t("settings.mcp.whyToolbar")}
          </h3>
          {/* Bold lead-in and body are separate keys so the em-dash layout stays
              in JSX rather than being baked into a translated string. */}
          {([
            { key: "perProject", Icon: FolderOpen },
            { key: "liveStatus", Icon: Activity },
            { key: "accessible", Icon: PanelRight },
          ] as const).map(({ key, Icon }) => (
            <div key={key} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/90">{t(`settings.mcp.${key}.term`)}</span>{" "}
                &mdash; {t(`settings.mcp.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
