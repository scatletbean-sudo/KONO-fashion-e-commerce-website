import "server-only";
import { prisma } from "@/lib/db/prisma";
import { assertMediaDevelopmentIdentity, assertMediaDevelopmentUrl } from "../media-dev-runtime";

export async function verifyMediaDevelopmentRuntime() {
  if (process.env.KONO_MEDIA_DEV_RUNTIME !== "1" || process.env.NODE_ENV !== "development"
    || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Media development runtime check is unavailable.");
  assertMediaDevelopmentUrl(process.env.DATABASE_URL);
  const identity = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`SELECT current_database() AS database,
      current_schema() AS schema, current_setting('neon.project_id', true) AS project,
      current_setting('neon.branch_id', true) AS branch, current_setting('neon.endpoint_id', true) AS endpoint,
      current_setting('transaction_read_only') AS "readOnly"`;
    return rows[0];
  });
  console.info("KONO media runtime READ ONLY identity:", identity);
  assertMediaDevelopmentIdentity(identity);
  return identity;
}
