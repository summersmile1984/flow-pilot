import { useCallback, type ComponentProps } from "react";
import { InputBar } from "./input-bar";
import { PermissionPrompt } from "./PermissionPrompt";
import { MastraApprovalPanel } from "./MastraApprovalPanel";
import { MastraQuestionPanel } from "./MastraQuestionPanel";
import { WorktreeBar } from "./WorktreeBar";
import type { MastraApprovalRequest, MastraQuestionRequest } from "@/hooks/session/useSessionLifecycle";

type InputBarProps = ComponentProps<typeof InputBar>;
type PermissionPromptProps = ComponentProps<typeof PermissionPrompt>;

interface BottomComposerProps extends InputBarProps {
  pendingPermission: PermissionPromptProps["request"] | null;
  onRespondPermission: PermissionPromptProps["onRespond"];
  pendingMastraApproval?: MastraApprovalRequest | null;
  onMastraApprove?: (toolCallId: string) => void;
  onMastraDecline?: (toolCallId: string) => void;
  pendingMastraQuestion?: MastraQuestionRequest | null;
  onMastraQuestionAnswer?: (toolCallId: string, answer: string | string[]) => void;
  selectedWorktreePath?: string | null;
  onSelectWorktree?: (path: string) => void;
  isEmptySession?: boolean;
}

export function BottomComposer({
  pendingPermission,
  onRespondPermission,
  pendingMastraApproval,
  onMastraApprove,
  onMastraDecline,
  pendingMastraQuestion,
  onMastraQuestionAnswer,
  selectedWorktreePath,
  onSelectWorktree,
  isEmptySession,
  ...inputBarProps
}: BottomComposerProps) {
  const hasPendingPermission = !!pendingPermission;
  const hasPendingMastraApproval = !!pendingMastraApproval;
  const hasPendingMastraQuestion = !!pendingMastraQuestion;
  const hasAnyPending = hasPendingPermission || hasPendingMastraApproval || hasPendingMastraQuestion;

  // Wrap InputBar's onSend for WorktreeBar's simpler (text-only) signature
  const handleWorktreeSend = useCallback(
    (text: string) => inputBarProps.onSend(text),
    [inputBarProps.onSend],
  );

  return (
    <>
      {onSelectWorktree && (
        <WorktreeBar
          projectPath={inputBarProps.projectPath}
          selectedWorktreePath={selectedWorktreePath ?? null}
          onSelectWorktree={onSelectWorktree}
          onSend={handleWorktreeSend}
          isEmptySession={isEmptySession ?? false}
        />
      )}
      {pendingPermission ? (
        <PermissionPrompt
          key={pendingPermission.requestId}
          request={pendingPermission}
          onRespond={onRespondPermission}
        />
      ) : null}
      {pendingMastraApproval && onMastraApprove && onMastraDecline ? (
        <MastraApprovalPanel
          key={pendingMastraApproval.toolCallId}
          request={pendingMastraApproval}
          onApprove={onMastraApprove}
          onDecline={onMastraDecline}
        />
      ) : null}
      {pendingMastraQuestion && onMastraQuestionAnswer ? (
        <MastraQuestionPanel
          key={pendingMastraQuestion.toolCallId}
          request={pendingMastraQuestion}
          onAnswer={onMastraQuestionAnswer}
        />
      ) : null}
      <div
        hidden={hasAnyPending}
        aria-hidden={hasAnyPending}
        inert={hasAnyPending || undefined}
      >
        <InputBar {...inputBarProps} />
      </div>
    </>
  );
}
