import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@rightsrail/shared-ts": resolve("packages/shared-ts/src/index.ts"),
      "@rightsrail/genlayer-client": resolve("packages/genlayer-client/src/index.ts"),
      "@rightsrail/indexer": resolve("packages/indexer/src/index.ts"),
    },
  },
  test: {
    include: ["tests/ts/**/*.test.ts", "packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
  },
});
