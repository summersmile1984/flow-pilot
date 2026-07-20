import { useState } from "react";
import { ShieldAlert, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOTTOM_CHAT_MAX_WIDTH_CLASS } from "@/lib/layout/constants";

interface MastraApprovalRequest {
  toolCallId: string;
  toolName?: string;
  input?: unknown;
  sessionId?: string;
}

interface MastraApprovalPanelProps {
  request: MastraApprovalRequest;
  onApprove: (toolCallId: string) => void;
  onDecline: (toolCallId: string) => void;
}

export function MastraApprovalPanel({ request, onApprove, onDecline }: MastraApprovalPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState<"approve" | "decline" | null>(null);

  const handleApprove = async () => {
    if (submitting) return;
    setSubmitting("approve");
    try {
      onApprove(request.toolCallId);
    } finally {
      setSubmitting(null);
    }
  };

  const handleDecline = async () => {
    if (submitting) return;
    setSubmitting("decline");
    try {
      onDecline(request.toolCallId);
    } finally {
      setSubmitting(null);
    }
  };

  const toolLabel = request.toolName || "Tool";
  const hasDetails = request.input != null;

  return (
    <div className={`mx-auto w-full px-4 pb-4 ${BOTTOM_CHAT_MAX_WIDTH_CLASS}`}>
      <div className="pointer-events-auto rounded-2xl border border-amber-500/40 bg-amber-500/5 shadow-lg backdrop-blur-lg">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Approval Required
            </p>
            <p className="text-xs text-muted-foreground">
              Agent wants to use <code className="font-mono text-amber-600 dark:text-amber-400">{toolLabel}</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting !== null}
              onClick={handleDecline}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              {submitting === "decline" ? "Declining..." : "Decline"}
            </Button>
            <Button
              size="sm"
              disabled={submitting !== null}
              onClick={handleApprove}
              className="h-8 gap-1.5 text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              {submitting === "approve" ? "Approving..." : "Approve"}
            </Button>
          </div>
        </div>

        {/* Expandable details */}
        {hasDetails && (
          <div className="border-t border-amber-500/20">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide details" : "Show details"}
            </button>
            {expanded && (
              <div className="px-4 pb-3">
                <pre className="max-h-40 overflow-auto rounded-md bg-foreground/[0.04] px-3 py-2 font-mono text-[11px] text-foreground/75 whitespace-pre-wrap wrap-break-word">
                  {typeof request.input === "string"
                    ? request.input
                    : JSON.stringify(request.input, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
