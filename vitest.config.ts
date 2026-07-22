import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["electron/src/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
    // Component tests render translated copy — i18next must be initialized or
    // useTranslation() hands back raw keys.
    setupFiles: ["./src/test-setup.ts"],
  },
});
