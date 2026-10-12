"use client";
import { useEffect, useState } from "react";
import { catalogSchema, type StorefrontProduct } from "./catalog";

export function useCatalog(initial?: StorefrontProduct[]) {
  const [products, setProducts] = useState(initial ?? []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(initial ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (initial && attempt === 0) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setStatus("error"); }, 12000);
    async function load() {
      try {
        const response = await fetch("/api/products", { credentials: "omit", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Catalog unavailable");
        const result = catalogSchema.parse(await response.json());
        if (!controller.signal.aborted) { setProducts(result.data); setStatus("ready"); }
      } catch { if (!controller.signal.aborted) setStatus("error"); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [attempt, initial]);
  return { products, status, retry: () => { setStatus("loading"); setAttempt((value) => value + 1); } };
}
