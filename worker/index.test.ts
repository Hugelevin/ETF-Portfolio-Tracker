import { describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index";

const env: Env = {
  ALLOWED_ORIGINS: "https://hugelevin.github.io",
  ALLOWED_SYMBOLS: "ANAU-ETFP.MI,SPYY.DE",
};
const context = { waitUntil: vi.fn() } as unknown as ExecutionContext;

describe("market-data Worker", () => {
  it("reports health with CORS for the configured Pages origin", async () => {
    const response = await worker.fetch(new Request("https://worker.test/health", {
      headers: { Origin: "https://hugelevin.github.io" },
    }), env, context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://hugelevin.github.io");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects unconfigured Yahoo symbols before contacting the provider", async () => {
    const response = await worker.fetch(new Request("https://worker.test/yahoo/chart?symbol=FAKE.DE&range=1mo&interval=1d", {
      headers: { Origin: "https://hugelevin.github.io" },
    }), env, context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported symbol, range, or interval" });
  });
});
