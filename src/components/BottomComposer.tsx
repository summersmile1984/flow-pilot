import { useCallback, type ComponentProps } from "react";
import { InputBar } from "./input-bar";
import { PermissionPrompt } from "./PermissionPrompt";
import { MastraApprovalPanel } from "./MastraApprovalPanel";
import { WorktreeBar } from "./WorktreeBar";
import type { MastraApprovalRequest } from "@/hooks/session/useSessionLifecycle";

type InputBarProps = ComponentProps<typeof InputBar>;
type PermissionPromptProps = ComponentProps<typeof PermissionPrompt>;

interface BottomComposerProps extends InputBarProps {
  pendingPermission: PermissionPromptProps["request"] | null;
  onRespondPermission: PermissionPromptProps["onRespond"];
  pendingMastraApproval?: MastraApprovalRequest | null;
  onMastraApprove?: (toolCallId: string) => void;
  onMastraDecline?: (toolCallId: string) => void;
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
  selectedWorktreePath,
  onSelectWorktree,
  isEmptySession,
  ...inputBarProps
}: BottomComposerProps) {
  const hasPendingPermission = !!pendingPermission;
  const hasPendingMastraApproval = !!pendingMastraApproval;
  const hasAnyPending = hasPendingPermission || hasPendingMastraApproval;

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
