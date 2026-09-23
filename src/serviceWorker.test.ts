// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const scope = "https://example.test/ETF-Portfolio-Tracker/";
const prefix = "etf-portfolio:/ETF-Portfolio-Tracker/:";
const assets = ["assets/main-abc.js", "assets/DetailDialog-def.js", "assets/MarketChart-ghi.js", "logo.svg"];
const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8")
  .replace('"__BUILD_VERSION__"', '"test-build"')
  .replace('"__BUILD_ASSETS__"', JSON.stringify(assets));

function harness(stores = new Map<string, Map<string, Response>>(), version = "test-build") {
  const listeners = new Map<string, (event: object) => void>();
  const fetch = vi.fn(async (request: Request | string) => new Response(typeof request === "string" ? request : request.url));
  const skipWaiting = vi.fn(async () => undefined);
  const keyOf = (request: Request | string) => typeof request === "string" ? request : request.url;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (request: Request | string) => store.get(keyOf(request))?.clone(),
        put: async (request: Request | string, response: Response) => { store.set(keyOf(request), response); },
        addAll: async (requests: Request[]) => {
          const responses = await Promise.all(requests.map((request) => fetch(request)));
          if (responses.some((response) => !response.ok)) throw new Error("Failed precache");
          requests.forEach((request, index) => store.set(keyOf(request), responses[index]!));
        },
      };
    },
  };
  runInNewContext(source.replace('"test-build"', JSON.stringify(version)), { URL, Request, Response, AbortSignal, caches, fetch, self: {
    registration: { scope }, location: { origin: "https://example.test" }, skipWaiting,
    clients: { claim: async () => undefined },
    addEventListener: (name: string, callback: (event: object) => void) => listeners.set(name, callback),
  } });
  async function lifecycle(name: string) {
    let work: Promise<unknown> | undefined;
    listeners.get(name)!({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
    await work;
  }
  function request(url: string, mode = "cors") {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({ request: { url, mode, method: "GET" }, respondWith: (promise: Promise<Response>) => { response = promise; } });
    return response;
  }
  return { stores, fetch, skipWaiting, lifecycle, request };
}

describe("offline service worker", () => {
  it("precaches lazy charts and serves them offline without another fetch", async () => {
    const app = harness();
    await app.lifecycle("install");
    expect(app.skipWaiting).toHaveBeenCalledOnce();
    app.fetch.mockClear();
    app.fetch.mockRejectedValue(new TypeError("Offline"));
    expect(await (await app.request(`${scope}assets/MarketChart-ghi.js`))?.text()).toBe(`${scope}assets/MarketChart-ghi.js`);
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it("never deletes another application's caches and retains the preceding build", async () => {
    const app = harness();
    for (const key of ["other-app", "etf-portfolio:/another/:old", `${prefix}oldest`, `${prefix}previous`]) app.stores.set(key, new Map([[`${scope}__precache_complete__`, new Response("complete")]]));
    await app.lifecycle("install");
    await app.lifecycle("activate");
    expect([...app.stores.keys()]).toEqual(["other-app", "etf-portfolio:/another/:old", `${prefix}previous`, `${prefix}test-build`]);
  });

  it("does not replace its known-good offline shell with an HTTP error", async () => {
    const app = harness();
    await app.lifecycle("install");
    app.fetch.mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    expect(await (await app.request(scope, "navigate"))?.text()).toBe(scope);
    app.fetch.mockRejectedValue(new TypeError("Offline"));
    expect(await (await app.request(scope, "navigate"))?.text()).toBe(scope);
  });

  it("does not take control when required assets fail to install", async () => {
    const app = harness();
    app.fetch.mockResolvedValue(new Response("Missing chunk", { status: 404 }));
    await expect(app.lifecycle("install")).rejects.toThrow("Failed precache");
    expect(app.skipWaiting).not.toHaveBeenCalled();
    expect(app.stores.has(`${prefix}test-build`)).toBe(false);
  });

  it("keeps the last complete release after a failed install and subsequent upgrade", async () => {
    const old = harness(undefined, "old");
    await old.lifecycle("install");
    old.stores.get(`${prefix}old`)!.set(`${scope}assets/old-lazy.js`, new Response("old chunk"));
    const failed = harness(old.stores, "failed");
    failed.fetch.mockResolvedValue(new Response("Missing", { status: 404 }));
    await expect(failed.lifecycle("install")).rejects.toThrow();
    // Also ignore abandoned caches from interrupted installs in older versions.
    old.stores.set(`${prefix}abandoned`, new Map());
    const next = harness(old.stores, "next");
    await next.lifecycle("install");
    await next.lifecycle("activate");
    next.fetch.mockRejectedValue(new TypeError("Offline"));
    expect(await (await next.request(`${scope}assets/old-lazy.js`))?.text()).toBe("old chunk");
    expect([...next.stores.keys()]).toEqual([`${prefix}old`, `${prefix}next`]);
  });

  it("ignores provider requests and other GitHub Pages projects", () => {
    const app = harness();
    expect(app.request("https://market.test/yahoo/chart")).toBeUndefined();
    expect(app.request("https://example.test/another-project/main.js")).toBeUndefined();
  });
});
