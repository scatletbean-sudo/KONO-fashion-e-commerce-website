import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual route handlers and guards with in-memory sessions/services.
// No Prisma, environment files, real credentials, or database connections.
const nativeRequire = createRequire(import.meta.url);
const apiRoot = path.resolve("src/app/api");
const routes = ["products", "categories", "collections", "sizes", "colors", "inventory", "admin", "dashboard"]
  .flatMap((group) => readdirSync(path.join(apiRoot, group), { recursive: true })
    .filter((file): file is string => typeof file === "string" && file.endsWith("route.ts"))
    .map((file) => path.join(apiRoot, group, file)));

type Session = { user: { id: string; role: string; status: string }; expiresAt: Date; revokedAt: Date | null };
const activeAdmin: Session = { user: { id: "admin", role: "ADMIN", status: "ACTIVE" }, expiresAt: new Date(Date.now() + 3600000), revokedAt: null };

function harness(session: Session | null, hasCookie = true) {
  const calls: string[] = [];
  const cache = new Map<string, unknown>();
  const fixture = { id: "p1", name: "Shirt", status: "ACTIVE", isActive: true, basePrice: 200, costPrice: 123,
    product: { status: "ACTIVE" }, variants: [{ id: "v1", isActive: true, costPrice: 123 }], inventory: { quantity: 10, reserved: 2 } };
  function load(file: string): Record<string, unknown> {
    if (cache.has(file)) return cache.get(file) as Record<string, unknown>;
    const loadedModule = { exports: {} as Record<string, unknown> };
    cache.set(file, loadedModule.exports);
    const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const mockedRequire = (specifier: string): unknown => {
      if (specifier === "next/headers") return { cookies: async () => ({ get: () => hasCookie ? { value: "synthetic-session-token" } : undefined }) };
      if (specifier === "next/navigation") return { redirect: () => { throw new Error("Unexpected redirect"); } };
      if (specifier.endsWith("/session.repository")) return { sessionRepository: { findByTokenHash: async () => session } };
      if (specifier.includes("/services/") && !specifier.endsWith("/session.service")) {
        return new Proxy({}, { get: (_target, service) => new Proxy({}, { get: (_object, method) => async () => {
          calls.push(`${String(service)}.${String(method)}`);
          return fixture;
        } }) });
      }
      if (specifier.includes("/schemas/") || specifier.includes("/query/")) {
        const schema = { safeParse: (data: unknown) => ({ success: true, data }), parse: (data: unknown) => data };
        return new Proxy({}, { get: () => schema });
      }
      if (specifier.startsWith("@/")) return load(path.resolve("src", specifier.slice(2) + ".ts"));
      return nativeRequire(specifier);
    };
    vm.runInNewContext(source, { exports: loadedModule.exports, module: loadedModule, require: mockedRequire, console: { error: () => undefined }, Date, URL, Buffer }, { filename: file });
    return loadedModule.exports;
  }
  return { load, calls, fixture };
}

function request(method: string) {
  const request = new Request("http://localhost/api/test", { method, ...(method === "GET" ? {} : { body: "{}" }) });
  Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
  return request;
}
const context = { params: Promise.resolve({ id: "p1", variantId: "v1", orderId: "o1" }) };
type Handler = (request: Request, routeContext: typeof context) => Promise<Response>;

for (const [label, session, cookie] of [
  ["anonymous", null, false], ["invalid session", null, true],
  ["CUSTOMER", { ...activeAdmin, user: { ...activeAdmin.user, role: "CUSTOMER" } }, true],
  ["STAFF", { ...activeAdmin, user: { ...activeAdmin.user, role: "STAFF" } }, true],
  ["inactive ADMIN", { ...activeAdmin, user: { ...activeAdmin.user, status: "INACTIVE" } }, true],
  ["banned ADMIN", { ...activeAdmin, user: { ...activeAdmin.user, status: "BANNED" } }, true],
  ["expired ADMIN", { ...activeAdmin, expiresAt: new Date(0) }, true],
  ["revoked ADMIN", { ...activeAdmin, revokedAt: new Date() }, true],
] as const) {
  test(`${label} cannot call any management write or private read`, async () => {
    const fixture = harness(session, cookie);
    let checked = 0;
    for (const file of routes) {
      const handlers = fixture.load(file);
      const privateRead = /[\\/](inventory|admin|dashboard)[\\/]/.test(file);
      for (const [method, handler] of Object.entries(handlers)) {
        if (!["GET", "POST", "PATCH", "DELETE"].includes(method) || (method === "GET" && !privateRead)) continue;
        const req = request(method);
        req.json = async () => { throw new Error("Unauthorized body must not be read"); };
        const response = await (handler as Handler)(req, context);
        assert.equal(response.status, 401, `${file} ${method}`);
        assert.equal(JSON.stringify(await response.json()).includes("costPrice"), false);
        checked++;
      }
    }
    assert.ok(checked >= 30);
    assert.deepEqual(fixture.calls, [], "no protected business service should run");
  });
}

test("active ADMIN reaches supported handlers; permanent Product DELETE is blocked", async () => {
  const fixture = harness(activeAdmin);
  for (const file of routes) {
    const handlers = fixture.load(file);
    for (const [method, handler] of Object.entries(handlers)) {
      if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) continue;
      const before = fixture.calls.length;
      const response = await (handler as Handler)(request(method), context);
      if (method === "DELETE" && /[\\/]products[\\/]\[id\][\\/]route\.ts$/.test(file)) {
        assert.equal(response.status, 409, file);
        assert.match((await response.json()).message, /Permanent product deletion is not supported/);
        assert.equal(fixture.calls.length, before, "blocked DELETE must not invoke any business service");
        continue;
      }
      assert.ok(response.status >= 200 && response.status < 300, `${file} ${method}: ${response.status}`);
      assert.ok(fixture.calls.length > before, `${file} ${method} must reach the existing service`);
    }
  }
});

test("public catalog stays sanitized with and without ADMIN cookies", async () => {
  for (const file of routes.filter((file) => !/[\\/](inventory|admin|dashboard)[\\/]/.test(file))) {
    for (const admin of [false, true]) {
      const fixture = harness(admin ? activeAdmin : null, admin);
      const handler = fixture.load(file).GET as Handler;
      const response = await handler(request("GET"), context);
      assert.equal(response.status, 200, file);
      const payload = JSON.stringify(await response.json());
      assert.equal(payload.includes('"costPrice"'), false, file);
      assert.equal(payload.includes('"inventory"'), false, file);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  }
});

test("ADMIN catalog reads retain management data on separate routes", async () => {
  const fixture = harness(activeAdmin);
  const catalogRoutes = routes.filter((file) => /[\\/]admin[\\/](products|categories|collections|colors|sizes|inventory)[\\/]/.test(file) && typeof fixture.load(file).GET === "function");
  assert.equal(catalogRoutes.length, 16);
  for (const file of catalogRoutes) {
    const response = await (fixture.load(file).GET as Handler)(request("GET"), context);
    assert.equal(response.status, 200, file);
    const payload = JSON.stringify(await response.json());
    assert.ok(payload.includes('"costPrice"'), file);
    assert.ok(payload.includes('"inventory"'), file);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});
