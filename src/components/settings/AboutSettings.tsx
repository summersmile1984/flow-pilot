import { memo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsHeader } from "@/components/settings/shared";

// ── Flow Pilot logo mark — a paper-plane heading along a flow line ──

function FlowPilotLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded square background */}
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.08" />
      {/* Flow line sweeping up to the mark */}
      <path
        d="M7 22c4 0 6.5-2 9-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />
      {/* Paper plane */}
      <path
        d="M25 8L14.5 18.5M25 8l-3.5 16-4-7-7-4L25 8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ──

export const AboutSettings = memo(function AboutSettings() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    window.claude.updater.currentVersion().then(setVersion);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader
        title={t("settings.about.title")}
        description={t("settings.about.description")}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-5">
          {/* ── App identity ── */}
          <div className="flex items-start gap-4">
            <FlowPilotLogo className="h-12 w-12 shrink-0 text-foreground" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                Flow Pilot
              </h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                {t("settings.about.tagline1")}
                <br />
                {t("settings.about.tagline2")}
              </p>
              {version && (
                <span className="mt-2 inline-flex items-center rounded-md bg-foreground/[0.05] px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  v{version}
                </span>
              )}
            </div>
          </div>

          {/* ── Credits ── */}
          <div className="mt-4 border-t border-foreground/[0.06] pt-4">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.about.creditsTitle")}
            </span>

            <div className="mt-3 rounded-xl border border-foreground/[0.06] bg-muted/20 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-[13px] font-medium text-foreground/90">
                  {t("settings.about.builtBy")}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("settings.about.license")}
              </p>
            </div>
          </div>

          {/* ── Tech acknowledgments ── */}
          <div className="mt-4 border-t border-foreground/[0.06] pt-4 pb-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.about.builtWith")}
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {/* Technology names — product names, never translated. */}
              {[
                "Electron",
                "React",
                "TypeScript",
                "Tailwind CSS",
                "ShadCN",
                "Claude Agent SDK",
                "Agent Client Protocol",
              ].map((tech) => (
                <span
                  key={tech}
                  className="inline-flex rounded-md bg-foreground/[0.04] px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});
