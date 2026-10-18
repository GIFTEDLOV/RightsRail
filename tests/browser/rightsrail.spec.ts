import { expect, test } from "@playwright/test";

test.describe("RightsRail local product qualification", () => {
  test("landing explains the product and reaches the controlled demo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Usage rights that understand the use." })).toBeVisible();
    await expect(page.getByText("BUILT FOR GENLAYER")).toBeVisible();
    await page.getByRole("link", { name: /See the controlled demo/ }).last().click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("CONTROLLED LOCAL QUALIFICATION").first()).toBeVisible();
  });

  test("control plane makes provenance impossible to confuse", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByText("CONTROLLED LOCAL QUALIFICATION").first()).toBeVisible();
    await expect(page.getByText("Frozen contract candidate")).toBeVisible();
    await expect(page.getByText("UNDEPLOYED").first()).toBeVisible();
    await expect(page.getByText("RIGHTSRAIL_USAGE_V1")).toBeVisible();
  });

  test("all four controlled cases preserve result and entitlement semantics", async ({ page }) => {
    const cases = [
      ["case-a", "PERMITTED", "PAYOUT ALLOCATED", true],
      ["case-b", "DENIED", "REFUND ALLOCATED", false],
      ["case-c", "INCONCLUSIVE", "REFUND ALLOCATED", false],
      ["case-d", "NOT_APPLICABLE", "REFUND ALLOCATED", false],
    ] as const;
    for (const [caseId, result, settlement, hasPermit] of cases) {
      await page.goto(`/demo/${caseId}`);
      await expect(page.getByRole("heading", { name: result }).first()).toBeVisible();
      await expect(page.getByText(settlement).first()).toBeVisible();
      if (hasPermit) await expect(page.getByText("Permit exists")).toBeVisible();
      else await expect(page.getByText("No permit")).toBeVisible();
      await expect(page.getByText("Protected asset", { exact: true })).toBeVisible();
      await expect(page.getByText("Proposed actual use", { exact: true })).toBeVisible();
    }
  });

  test("workflow routes and keyboard focus are usable", async ({ page }) => {
    await page.goto("/policies/new");
    await expect(page.getByRole("heading", { name: "Create a policy" })).toBeVisible();
    await expect(page.getByLabel("Reference asset source")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await page.goto("/requests/new");
    await expect(page.getByRole("heading", { name: "Prepare a usage request" })).toBeVisible();
    await page.goto("/evidence/evidence-case-a");
    await expect(page.getByRole("heading", { name: "evidence-case-a" })).toBeVisible();
  });

  test("wallet rejection is explicit and never leaves an uncertain broadcast", async ({ page }) => {
    await page.route("**/api/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            mode: "GENLAYER_CANONICAL",
            deployed: true,
            chainId: 61999,
            contractAddress: "0xdDB18c41B3033Ec2daD038F9547baAB913BEA2Aa",
            publicMethodCount: 36,
          },
          provenance: { canonical: true, chainId: 61999 },
        }),
      });
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, "ethereum", {
        value: {
          request: async ({ method }: { method: string }) => {
            if (method === "eth_requestAccounts") {
              const error = new Error("User rejected request") as Error & { code: number };
              error.code = 4001;
              throw error;
            }
            return "0xf22f";
          },
        },
      });
    });
    await page.goto("/transactions");
    await page.getByLabel("Contract method").selectOption("freeze_policy");
    await page.getByLabel("policy_id (string)").fill("policy-v241-lumen-finch-001");
    await page.getByRole("button", { name: "Review in wallet and sign" }).click();
    await expect(page.getByText("freeze_policy: REJECTED")).toBeVisible();
    await expect(page.getByText("User rejected request", { exact: false })).toBeVisible();
  });

  test("mobile comparison stacks without horizontal overflow", async ({ page }, testInfo) => {
    await page.goto("/demo/case-b");
    await expect(page.getByText("CONTROLLED LOCAL QUALIFICATION").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `screenshots/${testInfo.project.name}-demo-case-b-mobile.png`, fullPage: true });
  });

  test("flagship comparison renders without browser console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/demo/case-b");
    await expect(page.getByRole("heading", { name: "DENIED" }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("captures the core visual audit screens", async ({ page }, testInfo) => {
    const screens = [
      ["landing", "/"],
      ["app", "/app"],
      ["policy-detail", "/policies/policy-lumen-finch-001"],
      ["request-detail", "/requests/request-case-b"],
      ["evidence", "/evidence/evidence-case-b"],
      ["adjudication", "/adjudications/adj-case-a"],
      ["permit", "/permits/permit-case-a"],
      ["settlements", "/settlements"],
      ["demo-a", "/demo/case-a"],
      ["demo-b", "/demo/case-b"],
      ["demo-c", "/demo/case-c"],
      ["demo-d", "/demo/case-d"],
    ] as const;
    for (const [name, route] of screens) {
      await page.goto(route);
      await page.screenshot({ path: `screenshots/${testInfo.project.name}-${name}.png`, fullPage: true });
    }
  });
});
