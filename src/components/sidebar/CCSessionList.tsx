import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { CCSessionInfo } from "@/types";
import { captureException } from "@/lib/analytics/analytics";
import { useResolvedLanguage } from "@/hooks/useLanguage";
import type { ResolvedLanguage } from "@/lib/i18n";
import type { TFunction } from "i18next";

/**
 * Takes the resolved app locale rather than reading the OS one: the date format
 * should follow the language the user picked in settings. This used to be
 * hardcoded to "en-US", which ignored both.
 */
function formatRelativeDate(isoString: string, t: TFunction, locale: ResolvedLanguage): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("time.daysAgo", { count: diffDays });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function CCSessionList({
  projectPath,
  onSelect,
}: {
  projectPath: string;
  onSelect: (sessionId: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useResolvedLanguage();
  const [sessions, setSessions] = useState<CCSessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.claude.ccSessions
      .list(projectPath)
      .then((result) => {
        setSessions(result);
        setLoading(false);
      })
      .catch((err) => {
        captureException(err instanceof Error ? err : new Error(String(err)), { label: "CC_SESSION_LIST_ERR" });
        setLoading(false);
      });
  }, [projectPath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        No Claude Code sessions found
      </p>
    );
  }

  return (
    <>
      {sessions.map((s) => (
        <DropdownMenuItem
          key={s.sessionId}
          onClick={() => onSelect(s.sessionId)}
          className="flex flex-col items-start gap-0.5 py-2"
        >
          <span className="line-clamp-1 text-sm">{s.preview}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(s.timestamp, t, locale)} · {s.model}
          </span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
