/** A saved LLM API provider for the Pilot supervisor. */
export interface LlmProvider {
  /** Stable id, also used as the Mastra provider prefix (e.g. "deepseek"). */
  id: string;
  /** Display name shown in Settings and the picker (e.g. "DeepSeek"). */
  name: string;
  /** OpenAI-compatible base URL. Blank = use the provider's built-in default. */
  baseUrl: string;
  /** API key. Blank = fall back to the environment (.env). */
  apiKey: string;
  /** Selectable models offered by this provider (bare ids, e.g. "deepseek-chat"). */
  models: string[];
}
