import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import * as policy from "./media-policy";
import * as client from "./media-client";

const nativeRequire = createRequire(import.meta.url);
function components(products: unknown[] = []) {
  const cache = new Map<string, Record<string, unknown>>();
  function load(filename: string): Record<string, unknown> {
    const absolute = path.resolve(filename);
    if (cache.has(absolute)) return cache.get(absolute)!;
    const loaded = { exports: {} as Record<string, unknown> }; cache.set(absolute, loaded.exports);
    const source = ts.transpileModule(readFileSync(absolute, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    vm.runInNewContext(source, { exports: loaded.exports, module: loaded, URL, Date, Error,
      require: (name: string) => {
        if (name.endsWith("media-policy")) return policy;
        if (name.endsWith("media-client")) return client;
        if (name === "next/link") return { __esModule: true, default: "a" };
        if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
        if (name === "./useCatalog") return { useCatalog: () => ({ products, status: "ready", retry: () => undefined }) };
        if (name === "next/image") return { __esModule: true, default: ({ src, alt, style }: { src: string; alt: string; style: unknown }) => createElement("img", { src, alt, style }) };
        if (name.startsWith("@/") || name.startsWith(".")) {
          const base = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(absolute), name);
          return load(base + (existsSync(base + ".tsx") ? ".tsx" : ".ts"));
        }
        return nativeRequire(name);
      },
    });
    return loaded.exports;
  }
  return load;
}

const old = { id: "old", productId: "p", url: "https://legacy.example/full.jpg", alt: "Original alt", sortOrder: 0, isPrimary: true, imageType: "MULTI_VIEW" as const };

test("Media Manager renders legacy originals, categories, accessible reorder/metadata and removal confirmation", () => {
  const Manager = components()("src/components/admin/products/MediaManager.tsx").default as ComponentType<{ productId: string; productName: string; initialImages: policy.MediaImage[] }>;
  const html = renderToString(createElement(Manager, { productId: "p", productName: "KONO", initialImages: [old] }));
  assert.ok(html.includes(old.url)); assert.ok(html.includes("object-contain")); assert.ok(html.includes("Original alt"));
  for (const category of policy.imageTypes) assert.ok(html.includes(category));
  assert.ok(html.includes("Primary Image")); assert.ok(html.includes("Move image 1 earlier"));
  assert.ok(html.includes('accept="image/jpeg,image/png,image/webp"')); assert.ok(html.includes("Confirm removal"));
  assert.ok(html.includes("Its original file is retained")); assert.ok(html.includes("10 MB"));
  assert.equal(html.includes("CLOUDINARY_API_SECRET"), false);
});

test("Media Manager prevents selection of more files at 24 images without dropping existing images", () => {
  const Manager = components()("src/components/admin/products/MediaManager.tsx").default as ComponentType<{ productId: string; productName: string; initialImages: policy.MediaImage[] }>;
  const images = Array.from({ length: 24 }, (_, index) => ({ ...old, id: `image-${index}`, sortOrder: index }));
  const html = renderToString(createElement(Manager, { productId: "p", productName: "KONO", initialImages: images }));
  assert.match(html, /aria-label="Upload product images"[^>]*disabled/);
  assert.equal((html.match(/<article/g) ?? []).length, 24);
});

test("storefront contains MULTI_VIEW and renders expandable original SIZE_CHART with zoom action", () => {
  const product = { id: "p", slug: "kono", name: "KONO", basePrice: 100, categories: [], collections: [], variants: [],
    images: [old, { ...old, id: "chart", imageType: "SIZE_CHART", url: "https://legacy.example/chart.png", sortOrder: 1, isPrimary: false }] };
  const Detail = components([product])("src/components/storefront/ProductDetail.tsx").default as ComponentType<{ slug: string }>;
  const html = renderToString(createElement(Detail, { slug: "kono" }));
  assert.ok(html.includes("object-fit:contain")); assert.ok(html.includes("transform:none"), "Hover scaling must not crop multi-view originals"); assert.ok(html.includes("<summary>SIZE CHART</summary>"));
  assert.ok(html.includes("Expand and zoom")); assert.ok(html.includes("https://legacy.example/chart.png"));
});

test("full-image preview uses a native dialog, close action, scrollable zoom and contain at 100%", () => {
  const Preview = components()("src/components/media/ImagePreview.tsx").default as ComponentType<{ src: string; alt: string; onClose: () => void }>;
  const html = renderToString(createElement(Preview, { src: old.url, alt: "Size chart", onClose: () => undefined }));
  assert.ok(html.includes("<dialog")); assert.ok(html.includes('aria-label="Image zoom"')); assert.ok(html.includes('max="4"'));
  assert.ok(html.includes("Close preview")); assert.ok(html.includes("overflow-auto")); assert.ok(html.includes("object-fit:contain"));
});
