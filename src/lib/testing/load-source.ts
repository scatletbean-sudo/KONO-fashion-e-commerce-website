import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

// Load real schemas/services/routes with only explicitly supplied dependencies
// replaced. Refuse database imports unless a test supplies an in-memory client.
export function sourceLoader(mocks: Record<string, unknown>) {
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute)!;
    const loaded = { exports: {} as Record<string, unknown> };
    cache.set(absolute, loaded.exports);
    const source = ts.transpileModule(readFileSync(absolute, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const requireSource = (specifier: string): unknown => {
      const resolved = specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2))
        : specifier.startsWith(".") ? path.resolve(path.dirname(absolute), specifier) : null;
      if (specifier in mocks) return mocks[specifier];
      if (resolved && resolved in mocks) return mocks[resolved];
      if (specifier === "@/lib/db/prisma" || resolved === path.resolve("src/lib/db/prisma")) throw new Error("Database access forbidden in unit tests");
      return resolved ? load(resolved + ".ts") : nativeRequire(specifier);
    };
    vm.runInNewContext(source, { exports: loaded.exports, module: loaded, require: requireSource,
      console: { error: () => undefined }, Date, Error, URL, Buffer }, { filename: absolute });
    return loaded.exports;
  }
  return load;
}
