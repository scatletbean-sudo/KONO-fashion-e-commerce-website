import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Explicit opt-in config for KONO-MEDIA-DEV. Never falls back to DATABASE_URL.
const connection = new URL(env("KONO_MEDIA_DEV_DATABASE_URL"));
const endpoint = connection.hostname.split(".")[0].replace(/-pooler$/, "");
if (!["postgres:", "postgresql:"].includes(connection.protocol)
  || !connection.hostname.endsWith(".neon.tech")
  || endpoint !== "ep-fragrant-pine-b3qx5bzw"
  || decodeURIComponent(connection.pathname.slice(1)) !== "neondb") {
  throw new Error("Media development CLI configuration does not match the approved endpoint/database.");
}
connection.hostname = connection.hostname.replace(/-pooler\./, ".");
connection.searchParams.set("sslmode", "verify-full");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: connection.toString() },
});
