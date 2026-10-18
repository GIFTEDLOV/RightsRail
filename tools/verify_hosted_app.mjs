/** Verify the hosted canonical app against real finalized Studionet receipts. */
import { chromium } from "playwright";

const baseUrl = process.env.RIGHTSRAIL_APP_URL;
if (!baseUrl) throw new Error("RIGHTSRAIL_APP_URL is required");
const address = "0xdDB18c41B3033Ec2daD038F9547baAB913BEA2Aa";
const successHash = process.env.RIGHTSRAIL_SUCCESS_TX ?? "0x90c5d7eade35ee07bd74c3c70ad355b85bb21317ee2b4e64640a1f3e943c7afc";
const consensusFailureHash = process.env.RIGHTSRAIL_FAILED_TX ?? "0x88b45ad94f384756e7edb0733c9d70dde04a02b43f773e46f84b5700821e5892";
const oidc = process.env.VERCEL_OIDC_TOKEN;
const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

async function context() {
  return browser.newContext({
    extraHTTPHeaders: oidc ? { "x-vercel-trusted-oidc-idp-token": oidc } : {},
  });
}

async function verifyReceipt(hash, expectedState, expectedText = "") {
  const session = await context();
  const page = await session.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    {
      key: `rightsrail.transaction.${address}`,
      value: { method: "adjudicate_usage", state: "BROADCAST", hash },
    },
  );
  await page.goto(`${baseUrl}/transactions`, { waitUntil: "networkidle" });
  await page.getByText(`adjudicate_usage: ${expectedState}`).waitFor({ timeout: 120_000 });
  if (expectedText) await page.getByText(expectedText, { exact: false }).waitFor();
  await session.close();
}

try {
  const apiContext = await context();
  const response = await apiContext.request.get(`${baseUrl}/api/status`);
  if (!response.ok()) throw new Error(`HOSTED_STATUS_HTTP_${response.status()}`);
  const status = await response.json();
  if (
    status?.data?.chainId !== 61999
    || status?.data?.contractAddress !== address
    || status?.data?.publicMethodCount !== 36
  ) throw new Error("HOSTED_CANONICAL_STATUS_MISMATCH");
  await apiContext.close();

  await verifyReceipt(successHash, "CANONICAL_READBACK");
  await verifyReceipt(consensusFailureHash, "ERROR", "FINISHED_WITH_CONSENSUS_FAILURE");

  const demoContext = await context();
  const demo = await demoContext.newPage();
  demo.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  await demo.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
  await demo.getByText("CANONICAL STUDIONET QUALIFICATION").waitFor();
  const cards = await demo.locator(".demo-card").count();
  await demoContext.close();
  if (cards !== 4) throw new Error(`HOSTED_DEMO_CASE_COUNT:${cards}`);
  if (consoleErrors.length) {
    throw new Error(`HOSTED_CONSOLE_ERRORS:${consoleErrors.length}:${JSON.stringify(consoleErrors)}`);
  }
  console.log(JSON.stringify({ status: "PASS", url: baseUrl, receipt_recovery: true, consensus_failure_display: true, canonical_demo_cases: cards }));
} finally {
  await browser.close();
}
