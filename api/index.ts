import type { IncomingMessage, ServerResponse } from "node:http";

// Vercel compiles this TypeScript entry point as CommonJS. Keep the ESM
// workspace API behind a native dynamic import so the function can load it.
export default async function rightsRailApi(req: IncomingMessage, res: ServerResponse) {
  const { handler } = await import("../apps/api/src/server.js");
  return handler(req, res);
}
