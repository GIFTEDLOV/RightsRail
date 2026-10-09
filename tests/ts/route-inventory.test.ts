import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product route inventory", () => {
  it("contains every required Phase 3 route declaration", () => {
    const source = readFileSync(new URL("../../apps/web/src/main.tsx", import.meta.url), "utf8");
    for (const route of ["/", "/app", "/policies", "/policies/new", "/policies/:id", "/requests", "/requests/new", "/requests/:id", "/evidence/:id", "/adjudications/:id", "/permits/:id", "/settlements", "/activity", "/integrate", "/demo"]) {
      expect(source).toContain(`path=\"${route}\"`);
    }
  });

  it("labels the product as local and undeployed in the product shell", () => {
    const source = readFileSync(new URL("../../apps/web/src/main.tsx", import.meta.url), "utf8");
    expect(source).toContain("CONTROLLED LOCAL QUALIFICATION");
    expect(source).toContain("UNDEPLOYED");
    expect(source).toContain("NO NETWORK WRITES");
  });
});
