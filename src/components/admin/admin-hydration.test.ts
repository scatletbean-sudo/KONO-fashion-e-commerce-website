import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";
import { sourceLoader } from "@/lib/testing/load-source";

const nativeRequire = createRequire(import.meta.url);

test("Sidebar/Header SSR HTML is identical for differing router pathnames and keeps navigation rendered", () => {
  let pathname: string | null = null;
  const hook = sourceLoader({ "next/navigation": { usePathname: () => pathname } })("src/components/admin/useAdminPathname.ts");
  function component(filename: string) {
    const loaded = { exports: {} as { default: ComponentType } };
    const source = ts.transpileModule(readFileSync(path.resolve("src/components/admin", filename), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, { exports: loaded.exports, module: loaded, require: (specifier: string) => {
      if (specifier === "./useAdminPathname") return hook;
      if (specifier === "next/link") return { __esModule: true, default: "a" };
      return nativeRequire(specifier);
    } });
    return loaded.exports.default;
  }
  const Sidebar = component("AdminSidebar.tsx");
  const Header = component("AdminHeader.tsx");
  const snapshots = [null, "/admin", "/admin/products", "/admin/products/create", "/admin/products/fixture/edit", "/admin/orders"].map(route => {
    pathname = route;
    return [renderToString(createElement(Sidebar)), renderToString(createElement(Header))];
  });
  for (const snapshot of snapshots) assert.deepEqual(snapshot, snapshots[0]);
  assert.match(snapshots[0][0], /<nav/);
  assert.match(snapshots[0][0], /Products/);
  assert.match(snapshots[0][0], /Orders/);
  assert.match(snapshots[0][1], /Administration/);
  assert.doesNotMatch(snapshots[0][0], /aria-current="page"/);
});
