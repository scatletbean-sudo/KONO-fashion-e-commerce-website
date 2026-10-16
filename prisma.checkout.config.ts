import { defineConfig } from "prisma/config";

// OFFLINE ONLY. No dotenv, real database URL, shadow database or production fallback.
// Use for validate/generate and schema-to-schema diff, never for deployment.
const args = process.argv.slice(2);
if (!["validate", "generate", "format"].includes(args[0]) &&
  !(args[0] === "migrate" && args[1] === "diff" && args.includes("--from-schema") && args.includes("--to-schema") &&
    !args.some(arg => arg.startsWith("--") && /datasource|migrations|shadow/.test(arg)))) {
  throw new Error("Checkout config permits offline schema operations only; deployment is not authorized.");
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Prisma's schema diff engine requires a URL even for two local datamodels.
  // A deliberately unreachable loopback port; no environment credential is read.
  datasource: { url: "postgresql://offline:offline@127.0.0.1:1/offline" },
});
