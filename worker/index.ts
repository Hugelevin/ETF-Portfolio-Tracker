export interface Env {
  ALLOWED_ORIGINS: string;
  ALLOWED_SYMBOLS?: string;
}

const DEFAULT_SYMBOLS = [
  "ANAU-ETFP.MI",
  "SPYY.DE",
  "VVSM.DE",
  "JEDI.DE",
  "VWCE.DE",
  "QUTM.DE",
  "VUAA.DE",
];
const RANGES = new Set(["1d", "5d", "1mo", "3mo", "1y", "max"]);
const INTERVALS = new Set(["5m", "1h", "1d"]);

const parseCsv = (value: string | undefined) =>
  (value ?? "").split(",").map((part) => part.trim()).filter(Boolean);

function corsHeaders(request: Request, env: Env): Headers {
  const allowed = new Set(parseCsv(env.ALLOWED_ORIGINS));
  const origin = request.headers.get("Origin") ?? "";
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  if (allowed.has(origin) || (origin.startsWith("http://localhost:") && allowed.has("http://localhost:*"))) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function json(request: Request, env: Env, body: unknown, status = 200, extra?: HeadersInit) {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

function originAllowed(request: Request, env: Env): boolean {
  if (request.headers.get("Origin") === null) return true;
  return corsHeaders(request, env).has("Access-Control-Allow-Origin");
}

function allowedSymbols(env: Env): Set<string> {
  return new Set(parseCsv(env.ALLOWED_SYMBOLS).length ? parseCsv(env.ALLOWED_SYMBOLS) : DEFAULT_SYMBOLS);
}

async function yahooChart(request: Request, env: Env, ctx: ExecutionContext, url: URL) {
  const symbol = url.searchParams.get("symbol") ?? "";
  const range = url.searchParams.get("range") ?? "1mo";
  const interval = url.searchParams.get("interval") ?? "1d";
  if (!allowedSymbols(env).has(symbol) || !RANGES.has(range) || !INTERVALS.has(interval)) {
    return json(request, env, { error: "Unsupported symbol, range, or interval" }, 400);
  }

  const upstream = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  upstream.searchParams.set("range", range);
  upstream.searchParams.set("interval", interval);
  upstream.searchParams.set("events", "history");
  const cacheKey = new Request(upstream.toString(), { method: "GET" });
  const edgeCache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    corsHeaders(request, env).forEach((value, key) => response.headers.set(key, value));
    response.headers.set("X-Portfolio-Cache", "HIT");
    return response;
  }

  const upstreamResponse = await fetch(upstream, {
    headers: { "Accept": "application/json", "User-Agent": "EUR-Portfolio-Tracker/1.0" },
  });
  const body = await upstreamResponse.text();
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", upstreamResponse.ok ? "public, max-age=60" : "no-store");
  headers.set("X-Market-Source", "Yahoo Finance chart");
  const response = new Response(body, { status: upstreamResponse.status, headers });
  if (upstreamResponse.ok) ctx.waitUntil(edgeCache.put(cacheKey, response.clone()));
  return response;
}

async function yahooSearch(request: Request, env: Env, url: URL) {
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 80) return json(request, env, { error: "Search must be 2–80 characters" }, 400);
  const upstream = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  upstream.searchParams.set("q", query);
  upstream.searchParams.set("quotesCount", "10");
  upstream.searchParams.set("newsCount", "0");
  const response = await fetch(upstream, { headers: { "Accept": "application/json", "User-Agent": "EUR-Portfolio-Tracker/1.0" } });
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(await response.text(), {
    status: response.status,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!originAllowed(request, env)) return json(request, env, { error: "Origin is not allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (request.method !== "GET") return json(request, env, { error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return json(request, env, { ok: true });
      if (url.pathname === "/yahoo/chart") return yahooChart(request, env, ctx, url);
      if (url.pathname === "/yahoo/search") return yahooSearch(request, env, url);
      return json(request, env, { error: "Not found" }, 404);
    } catch {
      return json(request, env, { error: "Market-data upstream request failed" }, 502);
    }
  },
};
