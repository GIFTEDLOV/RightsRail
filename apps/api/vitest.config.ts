import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@rightsrail/shared-ts": resolve(root, "../../packages/shared-ts/src/index.ts"),
      "@rightsrail/genlayer-client": resolve(root, "../../packages/genlayer-client/src/index.ts"),
      "@rightsrail/indexer": resolve(root, "../../packages/indexer/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
