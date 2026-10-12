import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { catalogSchema } from "./catalog";

// Loopback only: never fetch an arbitrary Host/forwarded URL or forward cookies.
// The public catalog has no slug endpoint, so resolve the slug from its list.
export const getServerCatalog = cache(async () => {
  const host = (await headers()).get("host") ?? "";
  const requestedPort = host.match(/:(\d+)$/)?.[1];
  const port = Number(process.env.PORT ?? requestedPort ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid application port");
  const response = await fetch(`http://127.0.0.1:${port}/api/products`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Catalog unavailable");
  return catalogSchema.parse(await response.json()).data;
});
