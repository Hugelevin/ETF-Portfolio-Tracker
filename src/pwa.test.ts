// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses the light header theme and uniform-background maskable icon", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  expect(manifest.theme_color).toBe("#f9fbfa");
  expect(html).toContain('<meta name="theme-color" content="#f9fbfa"');
  expect(manifest.icons.find((icon: { purpose: string }) => icon.purpose === "maskable").src).toBe("icon-maskable-512-v2.png");
  const svg = readFileSync(new URL("../public/icon-maskable.svg", import.meta.url), "utf8");
  expect(svg).toContain('<rect width="512" height="512" fill="#286f63"/>');
  expect(svg).not.toContain("#18564c");
});
