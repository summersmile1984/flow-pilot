import { memo, useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsHeader } from "@/components/settings/shared";

// ── Harnss logo mark — a stylized "H" rendered inline ──

function HarnssLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded square background */}
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.08" />
      {/* Stylized "H" with connected crossbar */}
      <path
        d="M10 8v16M22 8v16M10 16h12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ──

export const AboutSettings = memo(function AboutSettings() {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    window.claude.updater.currentVersion().then(setVersion);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader title="About" description="Version info, links & credits" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-5">
          {/* ── App identity ── */}
          <div className="flex items-start gap-4">
            <HarnssLogo className="h-12 w-12 shrink-0 text-foreground" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                Pilot
              </h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                Open-source desktop client for AI coding agents.
                <br />
                One app for Claude Code, Codex, and any ACP agent.
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
              Credits
            </span>

            <div className="mt-3 rounded-xl border border-foreground/[0.06] bg-muted/20 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-[13px] font-medium text-foreground/90">
                  Built by OpenSource
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Pilot is open-source under the MIT License. Contributions, bug reports,
                and feature requests are welcome on GitHub.
              </p>
            </div>
          </div>

          {/* ── Tech acknowledgments ── */}
          <div className="mt-4 border-t border-foreground/[0.06] pt-4 pb-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Built with
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
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
