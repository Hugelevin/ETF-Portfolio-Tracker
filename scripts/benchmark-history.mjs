// Synthetic holdings only. Run with: node scripts/benchmark-history.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const transpile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const dates = moduleUrl(transpile("../src/domain/dates.ts"));
const source = transpile("../src/domain/portfolio.ts").replace('"./dates"', JSON.stringify(dates));
const { buildPortfolioValueHistory } = await import(moduleUrl(source));
const positions = Array.from({ length: 8 }, (_, index) => ({
  instrument: { id: `synthetic-${index}`, currency: "EUR" },
  lots: Array.from({ length: 12 }, (_, month) => ({
    purchaseDate: new Date(Date.UTC(2010, month, 1)).toISOString().slice(0, 10),
    shares: 10, pricePerShare: 100, fees: 0,
  })),
}));
const histories = Object.fromEntries(positions.map((position) => [position.instrument.id,
  Array.from({ length: 4_000 }, (_, day) => ({
    timestamp: new Date(Date.UTC(2010, 0, 1 + day)).toISOString(), close: 100 + day / 100,
  })),
]));
const start = performance.now();
const history = buildPortfolioValueHistory(positions, histories);
console.log(JSON.stringify({ holdings: 8, inputPoints: 32_000, outputPoints: history.length, elapsedMs: Math.round(performance.now() - start) }));

// Optional reproducible comparison; git show is read-only and uses no shell.
const baselineIndex = process.argv.indexOf("--baseline");
if (baselineIndex >= 0) {
  const ref = process.argv[baselineIndex + 1];
  if (!ref || !/^[a-zA-Z0-9._/-]+$/.test(ref)) throw new Error("Supply a baseline commit or branch");
  const previous = execFileSync("git", ["show", `${ref}:src/domain/portfolio.ts`], { encoding: "utf8" });
  const compiled = ts.transpileModule(previous, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace('"./dates"', JSON.stringify(dates));
  const baseline = await import(moduleUrl(compiled));
  const baselineStart = performance.now();
  const baselineHistory = baseline.buildPortfolioValueHistory(positions, histories);
  const elapsedMs = Math.round(performance.now() - baselineStart);
  const sameResult = JSON.stringify(baselineHistory) === JSON.stringify(history);
  console.log(JSON.stringify({ baseline: ref, outputPoints: baselineHistory.length, elapsedMs, sameResult }));
  if (!sameResult) throw new Error("Synthetic baseline results differ");
}
