import { defineConfig } from "prisma/config";
import { deploymentConfiguration } from "./scripts/checkout-phase1-deploy-guard";

// Runner-only configuration: no dotenv, no DATABASE_URL and no default config.
// The runner verifies live identity, TLS, history, checksum and isolated pending set.
// The unchanged migration verifies identity/TLS again in its own DDL transaction.
const config = deploymentConfiguration(process.env, process.argv.slice(2));
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: config.staged },
  datasource: { url: config.url },
});
