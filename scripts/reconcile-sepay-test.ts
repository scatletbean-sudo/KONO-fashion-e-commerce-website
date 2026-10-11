import { argument, runTool, snapshot } from "./lib/sepay-test";

void runTool(async (db) => {
  // An actual READ ONLY transaction protects this tool even if future queries change.
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const value = await snapshot(tx, argument("--order-id"));
    if (value.notes !== "SEPAY_PHASE2_FIXTURE" || !value.orderNumber.startsWith("SEPAYTEST-")) throw new Error("Phase-two fixture required");
    return value;
  }, { isolationLevel: "RepeatableRead" });
  console.log(JSON.stringify(result, null, 2));
}, false);
