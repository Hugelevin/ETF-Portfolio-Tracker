import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

function offlineBuild(): Plugin {
  return {
    name: "versioned-offline-shell",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const publicRoot = fileURLToPath(new URL("./public/", import.meta.url));
      const source = readFileSync(resolve(publicRoot, "sw.js"), "utf8");
      const publicFiles = readdirSync(publicRoot, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name !== "sw.js")
        .map((entry) => relative(publicRoot, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"))
        .sort();
      const assets = [...Object.values(bundle).map((entry) => entry.fileName).filter((name) => name !== "index.html"), ...publicFiles].sort();
      const hash = createHash("sha256").update(source).update(JSON.stringify(assets));
      for (const entry of Object.values(bundle)) hash.update(entry.type === "chunk" ? entry.code : entry.source);
      for (const file of publicFiles) hash.update(readFileSync(resolve(publicRoot, file)));
      this.emitFile({ type: "asset", fileName: "sw.js", source: source
        .replace('"__BUILD_VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 16)))
        .replace('"__BUILD_ASSETS__"', JSON.stringify(assets)) });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), offlineBuild()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}", "worker/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    coverage: { reporter: ["text", "html"] },
  },
});
