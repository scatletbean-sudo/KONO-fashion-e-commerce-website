import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";

export function validateTestEnvironment(env: Record<string, string | undefined>, approvedHost: string, writes: boolean, approvedWrites: boolean) {
  if (env.SEPAY_MODE !== "test") throw new Error("Test mode required");
  if (!approvedHost || !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/i.test(approvedHost)) throw new Error("Approved Neon endpoint required");
  let host: string;
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    host = url.hostname;
  } catch { throw new Error("Invalid database configuration"); }
  if (host !== approvedHost || env.SEPAY_TEST_DATABASE_HOST !== approvedHost) throw new Error("Test endpoint mismatch");
  if (env.SEPAY_AUTO_CONFIRM_ENABLED === "true") throw new Error("Keep public auto-confirm disabled while running these tools");
  if (writes && !approvedWrites) throw new Error("Explicit --allow-test-writes required after approval");
}

export function argument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("Required argument missing");
  return value;
}

export async function connectTestDatabase(writes: boolean): Promise<PrismaClient> {
  validateTestEnvironment(process.env, argument("--host"), writes, process.argv.includes("--allow-test-writes"));
  // No dotenv import. Only the already configured process environment is used.
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("../../src/generated/prisma/client"), import("@prisma/adapter-pg"),
  ]);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
}

export async function runTool(action: (db: PrismaClient) => Promise<void>, writes: boolean) {
  let db: PrismaClient | undefined;
  try {
    db = await connectTestDatabase(writes);
    await action(db);
  } catch {
    console.error("SePay test tool failed. Check arguments, approved endpoint and test configuration; sensitive error details are suppressed.");
    process.exitCode = 1;
  } finally {
    try { await db?.$disconnect(); } catch { process.exitCode = 1; }
  }
}

export async function snapshot(db: PrismaClient | Prisma.TransactionClient, orderId: string) {
  return db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, status: true, currency: true, totalAmount: true, notes: true,
      payment: { select: {
        id: true, status: true, method: true, amount: true, paymentCode: true, paidAt: true,
        providerPaymentId: true,
        paymentEvents: { select: { provider: true, eventId: true, amount: true, currency: true }, orderBy: { createdAt: "asc" } },
      } },
      statusHistory: { select: { fromStatus: true, toStatus: true, changedById: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export function requireFreshFixture(value: Awaited<ReturnType<typeof snapshot>>) {
  if (value.notes !== "SEPAY_PHASE2_FIXTURE" || !value.orderNumber.startsWith("SEPAYTEST-") ||
      value.status !== "PENDING" || value.currency !== "VND" || value.totalAmount !== 100000 ||
      value.payment?.status !== "PENDING" || value.payment.method !== "BANK_TRANSFER" ||
      value.payment.amount !== 100000 || !value.payment.paymentCode || value.payment.paidAt ||
      value.payment.paymentEvents.length || value.statusHistory.length) throw new Error("Fresh phase-two fixture required");
}
