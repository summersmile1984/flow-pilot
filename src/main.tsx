import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { migrateLocalStorage } from "./lib/local-storage-migration";
import { migrateSettingsIfNeeded } from "./stores/settings-store";
import { initPostHog, posthog } from "./lib/analytics/posthog";
import { App } from "./App";
// Initializes the i18next singleton on import, reading the persisted language
// so the first paint is already in the right locale. Must precede any component
// that calls useTranslation().
import "./lib/i18n";
import "./index.css";

// Migrate localStorage keys from old "openacpui-*" prefix before React mounts
migrateLocalStorage();

// Hydrate Zustand settings store from legacy per-key localStorage entries.
// Must run before createRoot() so components read correct initial values.
migrateSettingsIfNeeded();

// Initialize posthog-js (starts opted-out until settings confirm opt-in)
initPostHog();

// Analytics opt-in sync is deferred to after React mount (in App.tsx useEffect)
// to avoid firing IPC calls before first paint.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
);
