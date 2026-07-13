import { describe, expect, it, vi } from "vitest";
import worker from "./index";

const env: Env = {
  ALLOWED_ORIGINS: "https://hugelevin.github.io,http://localhost:*",
  ALLOWED_SYMBOLS: "ANAU-ETFP.MI,0P0001CD0Q.F,SPYY.DE,VVSM.DE,JEDI.DE,VWCE.DE,QUTM.DE,VUAA.DE",
};
class TestSpan {
  get isTraced() { return false; }
  setAttribute() {}
  end() {}
}

const context: ExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: undefined,
  tracing: {
    enterSpan: vi.fn(),
    startActiveSpan: vi.fn(),
    Span: TestSpan,
  },
};

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
