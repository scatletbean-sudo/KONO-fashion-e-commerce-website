export const mediaDevelopmentTarget = {
  project: "hidden-forest-64993760", branch: "br-proud-field-b3xjljxh",
  endpoint: "ep-lucky-fire-b3froe7u", database: "neondb", schema: "public",
} as const;

export function assertMediaDevelopmentUrl(value: string | undefined) {
  let url: URL;
  try { url = new URL(value ?? ""); } catch { throw new Error("Missing media development database configuration."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname.endsWith(".neon.tech")
    || url.hostname.split(".")[0].replace(/-pooler$/, "") !== mediaDevelopmentTarget.endpoint
    || decodeURIComponent(url.pathname.slice(1)) !== mediaDevelopmentTarget.database
    || url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("Media development runtime database does not match the approved endpoint and strict SSL policy.");
  }
}

export function assertMediaDevelopmentIdentity(identity: Record<string, unknown>) {
  for (const [key, value] of Object.entries(mediaDevelopmentTarget)) {
    if (identity[key] !== value) throw new Error("Media development runtime database identity mismatch.");
  }
  if (identity.readOnly !== "on") throw new Error("Media development runtime check must be READ ONLY.");
}

export function mediaRequestOrigin(request: Request, localMediaDevelopment = false) {
  // Next's internal request URL can use localhost while the bound local server
  // is reached at 127.0.0.1. Permit only this exact opt-in loopback origin.
  return localMediaDevelopment && request.headers.get("host") === "127.0.0.1:3001"
    ? "http://127.0.0.1:3001" : new URL(request.url).origin;
}
