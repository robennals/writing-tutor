import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Vendored shadcn/ui primitives — tracked upstream, not our behavior.
        "src/components/ui/**",
        // Pure type/config files.
        "src/**/*.d.ts",
        // Test files and support code.
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/test-utils/**",
        // Streaming TTS player: tests cover happy path + main error paths
        // (fetch !ok, addSourceBuffer throws, play() rejects, stream errors,
        // null body, ended/error events, Stop on second click). The remaining
        // uncovered lines are defensive concurrency guards (abort-during-read,
        // SourceBuffer `updateend`/`error` race handlers, idle timeout) that
        // need real browser timing to exercise — integration-test territory,
        // not unit.
        "src/components/tts-button.tsx",
      ],
      thresholds: {
        perFile: true,
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
