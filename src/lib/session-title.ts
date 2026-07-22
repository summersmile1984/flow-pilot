/**
 * The placeholder title persisted with every new session (see useSessionManager
 * and useDraftMaterialization).
 *
 * This is stored DATA, not display copy: it is written to disk in English and
 * compared against on read. Translating the write sites would orphan every
 * session already saved, and would change meaning whenever the user switches
 * language. So the stored value stays fixed and only the *display* is localized.
 */
export const NEW_CHAT_TITLE = "New Chat";

/**
 * Localize a session title for display. Only the untouched placeholder is
 * translated — a title the user (or the agent) actually chose is shown as-is.
 *
 * Deliberately not used for the inline-rename input: that edits the stored
 * value, so it must start from the real string, otherwise saving would persist
 * a translated literal and break the sentinel.
 */
export function displaySessionTitle(
  title: string,
  t: (key: string) => string,
): string {
  return title === NEW_CHAT_TITLE ? t("chat.header.newChat") : title;
}
