import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // Server-side logic: the libraries, the middleware and the route
      // handlers. React pages and components are not measured.
      include: ["src/lib/**/*.ts", "src/middleware.ts", "src/app/**/route.ts"],
      exclude: ["src/**/*.test.ts"],
      // Must move in step with .github/quality-policy.jsonc. Measured
      // baseline at migration, not a target. Ratchet upward only.
      thresholds: {
        lines: 97,
        functions: 96,
        branches: 98,
      },
    },
  },
});
