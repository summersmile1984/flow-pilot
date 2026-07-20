import { useState } from "react";
import { MessageCircleQuestion, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOTTOM_CHAT_MAX_WIDTH_CLASS } from "@/lib/layout/constants";
import type { MastraQuestionRequest } from "@/hooks/session/useSessionLifecycle";

interface MastraQuestionPanelProps {
  request: MastraQuestionRequest;
  onAnswer: (toolCallId: string, answer: string | string[]) => void;
}

/**
 * Interactive panel for the built-in `ask_user` tool: renders the agent's
 * question with clickable options (single or multi select) or a free-text
 * input, and resumes the suspended run with the user's answer.
 */
export function MastraQuestionPanel({ request, onAnswer }: MastraQuestionPanelProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isMulti = request.selectionMode === "multi_select";
  const hasOptions = !!request.options?.length;

  const submit = (answer: string | string[]) => {
    if (submitted) return;
    setSubmitted(true);
    onAnswer(request.toolCallId, answer);
  };

  const toggle = (label: string) => {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  return (
    <div className={`mx-auto w-full px-4 pb-4 ${BOTTOM_CHAT_MAX_WIDTH_CLASS}`}>
      <div className="pointer-events-auto rounded-2xl border border-sky-500/40 bg-sky-500/5 shadow-lg backdrop-blur-lg">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-3 pb-2">
          <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground whitespace-pre-wrap">
              {request.question}
            </p>
            {isMulti && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select all that apply, then confirm
              </p>
            )}
          </div>
        </div>

        {/* Options */}
        {hasOptions && (
          <div className="flex flex-col gap-1.5 px-4 pb-3">
            {request.options!.map((opt) => {
              const isSelected = selected.includes(opt.label);
              return (
                <button
                  key={opt.label}
                  type="button"
                  disabled={submitted}
                  onClick={() => (isMulti ? toggle(opt.label) : submit(opt.label))}
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                    isSelected
                      ? "border-sky-500/60 bg-sky-500/10"
                      : "border-border/60 bg-foreground/[0.02] hover:border-sky-500/40 hover:bg-sky-500/5"
                  }`}
                >
                  {isMulti && (
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-sky-500 bg-sky-500 text-white"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {isMulti && (
              <div className="mt-1 flex justify-end">
                <Button
                  size="sm"
                  disabled={submitted || selected.length === 0}
                  onClick={() => submit(selected)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  {submitted ? "Sending..." : `Confirm${selected.length ? ` (${selected.length})` : ""}`}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Free-text answer (no options provided) */}
        {!hasOptions && (
          <form
            className="flex items-center gap-2 px-4 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (freeText.trim()) submit(freeText.trim());
            }}
          >
            <input
              autoFocus
              value={freeText}
              disabled={submitted}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Type your answer..."
              className="h-9 min-w-0 flex-1 rounded-xl border border-border/60 bg-foreground/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-sky-500/50"
            />
            <Button
              type="submit"
              size="sm"
              disabled={submitted || !freeText.trim()}
              className="h-9 gap-1.5 text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              {submitted ? "Sending..." : "Answer"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
