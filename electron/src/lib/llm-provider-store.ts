/**
 * Main-process store for the Pilot supervisor's LLM providers.
 *
 * A single JSON list in the app data dir: each provider carries its own base
 * URL, API key, and model list. The user manages them in Settings and selects
 * a provider+model in the engine picker. API keys are kept out of the renderer
 * localStorage (main-process file, matching the app-settings precedent).
 */

import path from "path";
import fs from "fs";
import { getDataDir } from "./data-dir";
import { getAppSettings } from "./app-settings";
import { log } from "./logger";
import type { LlmProvider } from "@shared/types/llm-provider";

export type { LlmProvider } from "@shared/types/llm-provider";

function filePath(): string {
  return path.join(getDataDir(), "llm-providers.json");
}

let cached: LlmProvider[] | null = null;

/** The default provider seeded on first run (empty key/url → resolves via .env). */
function defaultProviders(): LlmProvider[] {
  // Migrate the old single-provider settings into the seeded DeepSeek entry.
  const s = getAppSettings();
  return [
    {
      id: "deepseek",
      name: "DeepSeek",
      baseUrl: (s.pilotSupervisorBaseUrl || "").trim(),
      apiKey: (s.pilotSupervisorApiKey || "").trim(),
      models: ["deepseek-chat", "deepseek-reasoner"],
    },
  ];
}

export function loadLlmProviders(): LlmProvider[] {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(filePath(), "utf-8");
    const parsed = JSON.parse(raw) as LlmProvider[];
    cached = Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultProviders();
  } catch {
    cached = defaultProviders();
    persist();
  }
  return cached;
}

function persist(): void {
  try {
    fs.writeFileSync(filePath(), JSON.stringify(cached ?? [], null, 2), "utf-8");
  } catch (err) {
    log("llm-provider-store", `Persist failed: ${err}`);
  }
}

export function saveLlmProvider(provider: LlmProvider): LlmProvider[] {
  const list = loadLlmProviders().slice();
  const idx = list.findIndex((p) => p.id === provider.id);
  if (idx >= 0) list[idx] = provider;
  else list.push(provider);
  cached = list;
  persist();
  return list;
}

export function deleteLlmProvider(id: string): LlmProvider[] {
  cached = loadLlmProviders().filter((p) => p.id !== id);
  persist();
  return cached;
}

/**
 * Resolve a compound `providerId::modelId` selection to the provider and model.
 * Falls back to the first provider / its first model for unknown or bare input.
 */
export function resolveProviderModel(compound: string | undefined): {
  provider: LlmProvider | undefined;
  modelId: string;
} {
  const providers = loadLlmProviders();
  let providerId: string | undefined;
  let modelId: string | undefined;
  if (compound?.includes("::")) {
    [providerId, modelId] = compound.split("::");
  }
  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const model = provider && modelId && provider.models.includes(modelId)
    ? modelId
    : provider?.models[0] ?? "deepseek-chat";
  return { provider, modelId: model };
}
