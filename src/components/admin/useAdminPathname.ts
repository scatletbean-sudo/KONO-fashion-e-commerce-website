"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// The hydration snapshot must match SSR even if the router initially exposes
// different pathnames. Subsequent renders/navigation use the live router value.
export function useAdminPathname() {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return hydrated ? pathname : null;
}
