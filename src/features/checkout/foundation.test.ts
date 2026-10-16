import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Prisma } from "@/generated/prisma/client";
import { sourceLoader } from "@/lib/testing/load-source";
import { checkoutDevelopmentConnection } from "../../../scripts/checkout-phase1-preflight";
import {
  assertAttemptTransition, checkoutAttemptSchema, developmentCheckoutProposal, fingerprint,
  guestOrderFoundationSchema, hashIdempotencyKey, inspectRetry, itemSnapshotSchema,
  planReservationTransition, proposedHoldExpiry, reservationSchema, shippingSnapshotSchema, vndSchema,
} from "./foundation";

const now = new Date("2026-10-17T00:00:00Z");
const expiresAt = proposedHoldExpiry(now);
const shipping = { recipientName: "Guest", recipientPhone: "0901234567", provinceCode: "TEST", provinceName: "Test province", wardCode: "TEST-WARD", wardName: "Test ward", addressLine: "Test address", countryCode: "VN", shippingMethod: "STANDARD", shippingAmount: 30000 };
const line = { productId: "p", variantId: "v", productName: "Snapshot name", sku: "SKU", colorName: "Black", sizeName: "M", quantity: 2, unitPrice: 899000, totalPrice: 1798000 };
const guest = { customerName: "Guest", customerPhone: "0901234567", currency: "VND", paymentMethod: "COD", shipping, items: [line], subtotal: 1798000, discountAmount: 0, taxAmount: 0, totalAmount: 1828000 };
const attempt = { ownerHash: "a".repeat(64), keyHash: hashIdempotencyKey("opaque-checkout-key-1"), requestFingerprint: fingerprint(guest), quoteFingerprint: fingerprint({ amount: 1828000 }), status: "PENDING" as const, orderId: null, createdAt: now, expiresAt, completedAt: null };
const reservation = { id: "r", orderItemId: "oi", inventoryId: "i", quantity: 2, status: "HELD" as const, createdAt: now, expiresAt, releasedAt: null, consumedAt: null };
const schema = readFileSync("prisma/schema.prisma", "utf8");
const model = (name: string) => {
  const body = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  assert.ok(body, name);
  return { body, uniqueFields: [...body.matchAll(/@@unique\(\[([^\]]+)\]\)/g)].map(match => match[1].split(",").map(value => value.trim())) };
};
const field = (table: string, name: string) => {
  const line = model(table).body.split("\n").find(row => row.trim().startsWith(name + " "));
  assert.ok(line, table + "." + name);
  const type = line.trim().split(/\s+/)[1];
  return { isRequired: !type.endsWith("?"), isUnique: line.includes("@unique"), kind: /^(String|Int)/.test(type) ? "scalar" : "object", relationOnDelete: line.match(/onDelete: (\w+)/)?.[1] };
};

test("guest foundation requires no fake User or Address and normalizes absent/null email", () => {
  const parsed = guestOrderFoundationSchema.parse(guest);
  assert.equal(parsed.customerEmail, null);
  assert.equal(parsed.userId, undefined);
  assert.equal(guestOrderFoundationSchema.parse({ ...guest, customerEmail: null }).customerEmail, null);
  assert.equal(guestOrderFoundationSchema.safeParse({ ...guest, customerEmail: "invalid" }).success, false);
  assert.equal(guestOrderFoundationSchema.safeParse({ ...guest, userId: "fake" }).success, false);
  assert.equal(guestOrderFoundationSchema.safeParse({ ...guest, paymentMethod: "BANK_TRANSFER" }).success, false);
});

test("Prisma input types accept legacy Order fields and optional guest email without snapshots", () => {
  const legacy = { orderNumber: "offline-only", customerName: "Legacy", customerPhone: "0901234567", customerEmail: "test@example.invalid", subtotal: 1, totalAmount: 1 } satisfies Prisma.OrderUncheckedCreateInput;
  const nullable = { ...legacy, customerEmail: null } satisfies Prisma.OrderUncheckedCreateInput;
  assert.equal(nullable.customerEmail, null);
  for (const name of ["userId", "addressId", "customerEmail", "recipientName", "recipientPhone", "provinceCode", "provinceName", "wardCode", "wardName", "addressLine", "countryCode", "shippingMethod"])
    assert.equal(field("Order", name).isRequired, false, name);
  assert.equal(field("OrderItem", "colorName").isRequired, false);
  assert.equal(field("OrderItem", "sizeName").isRequired, false);
});

test("product snapshots are scalar copies independent of mutable variant data", () => {
  const variant = { colorName: "Black", sizeName: "M" };
  const snapshot = itemSnapshotSchema.parse({ ...line, ...variant });
  variant.colorName = "Renamed"; variant.sizeName = "XL";
  assert.equal(snapshot.colorName, "Black"); assert.equal(snapshot.sizeName, "M");
  for (const name of ["productName", "sku", "colorName", "sizeName", "unitPrice", "quantity", "totalPrice"])
    assert.equal(field("OrderItem", name).kind, "scalar");
});

test("validation rejects incomplete shipping, invalid VND, wrong totals and duplicate variants", () => {
  assert.equal(shippingSnapshotSchema.safeParse({ ...shipping, wardCode: "" }).success, false);
  for (const value of [-1, 0.5, 2147483648, NaN, Infinity]) assert.equal(vndSchema.safeParse(value).success, false);
  assert.equal(vndSchema.safeParse(2147483647).success, true);
  for (const patch of [{ totalPrice: 1 }, { quantity: 0 }, { quantity: -1 }, { unitPrice: 2147483648 }])
    assert.equal(itemSnapshotSchema.safeParse({ ...line, ...patch }).success, false);
  assert.equal(guestOrderFoundationSchema.safeParse({ ...guest, totalAmount: 1 }).success, false);
  assert.equal(guestOrderFoundationSchema.safeParse({ ...guest, items: [line, line] }).success, false);
});

test("owner/key unique and one reservation per item are declared in Prisma schema and migration", () => {
  assert.ok(model("CheckoutAttempt").uniqueFields.some(fields => fields.join(",") === "ownerHash,keyHash"));
  assert.equal(field("CheckoutAttempt", "orderId").isUnique, true);
  assert.equal(field("InventoryReservation", "orderItemId").isUnique, true);
  assert.equal(field("InventoryReservation", "orderItem").relationOnDelete, "Restrict");
  assert.equal(field("InventoryReservation", "inventory").relationOnDelete, "Restrict");
});

test("canonical fingerprints ignore object-key order, preserve content differences and hash keys", () => {
  assert.equal(fingerprint({ a: 1, nested: { b: 2, a: 3 } }), fingerprint({ nested: { a: 3, b: 2 }, a: 1 }));
  assert.notEqual(fingerprint(guest), fingerprint({ ...guest, totalAmount: 1 }));
  assert.notEqual(hashIdempotencyKey("opaque-checkout-key-1"), hashIdempotencyKey("opaque-checkout-key-2"));
  assert.match(attempt.keyHash, /^[a-f0-9]{64}$/);
  for (const raw of [undefined, new Date(), { value: undefined }, NaN]) assert.throws(() => fingerprint(raw));
});

test("retry rejects changed payload or owner and replays committed result even past deadline", () => {
  assert.equal(inspectRetry(attempt, attempt, now).outcome, "pending");
  assert.equal(inspectRetry(attempt, attempt, expiresAt).outcome, "expired");
  for (const patch of [{ ownerHash: "b".repeat(64) }, { keyHash: "b".repeat(64) }, { requestFingerprint: "b".repeat(64) }, { quoteFingerprint: "b".repeat(64) }])
    assert.throws(() => inspectRetry(attempt, { ...attempt, ...patch }, now));
  const completed = { ...attempt, status: "COMPLETED" as const, orderId: "o", completedAt: now };
  assert.deepEqual(inspectRetry(completed, attempt, new Date(expiresAt.getTime() + 1)), { outcome: "replay", orderId: "o" });
  assert.equal(checkoutAttemptSchema.safeParse({ ...attempt, status: "COMPLETED" }).success, false);
  for (const to of ["COMPLETED", "FAILED", "EXPIRED"] as const) assert.doesNotThrow(() => assertAttemptTransition("PENDING", to));
  assert.throws(() => assertAttemptTransition("COMPLETED", "FAILED"));
});

test("reservation plans prevent repeat release/consume and never write inventory themselves", () => {
  for (const target of ["RELEASED", "CONSUMED"] as const) {
    const plan = planReservationTransition(reservation, target, now);
    assert.equal(plan.apply, true); if (!plan.apply) throw new Error("Missing plan");
    assert.deepEqual(plan.where, { id: "r", status: "HELD" });
    assert.equal(plan.reservedDelta, -2); assert.equal(plan.quantityDelta, target === "CONSUMED" ? -2 : 0);
    const terminal = { ...reservation, ...plan.data };
    assert.deepEqual(planReservationTransition(terminal, target, now), { apply: false, quantityDelta: 0, reservedDelta: 0 });
    assert.throws(() => planReservationTransition(terminal, target === "CONSUMED" ? "RELEASED" : "CONSUMED", now));
  }
  assert.equal(reservationSchema.safeParse({ ...reservation, quantity: 0 }).success, false);
  assert.equal(reservationSchema.safeParse({ ...reservation, status: "RELEASED", releasedAt: null }).success, false);
  assert.equal(reservation.status, "HELD");
  assert.equal(expiresAt.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(developmentCheckoutProposal.automaticExpiry, false);
  assert.equal(developmentCheckoutProposal.environment, "development");
});

test("Development guard has no production fallback and forces verified TLS/read-only sessions", () => {
  const development = "postgresql://offline:offline@ep-lucky-fire-b3froe7u-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb";
  assert.throws(() => checkoutDevelopmentConnection({ DATABASE_URL: development }));
  for (const value of [development.replace("ep-lucky-fire", "ep-wrong"), development.replace("/neondb", "/other"), development.replace(".neon.tech", ".evil.invalid")])
    assert.throws(() => checkoutDevelopmentConnection({ KONO_MEDIA_DEV_DATABASE_URL: value }));
  assert.throws(() => checkoutDevelopmentConnection({ KONO_MEDIA_DEV_DATABASE_URL: development, NODE_TLS_REJECT_UNAUTHORIZED: "0" }));
  const url = new URL(checkoutDevelopmentConnection({ KONO_MEDIA_DEV_DATABASE_URL: development }));
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
  assert.match(url.searchParams.get("options")!, /default_transaction_read_only=on/);
});

test("offline Prisma config rejects database/deploy/reset operations and reads no environment", () => {
  for (const args of [["migrate", "deploy"], ["migrate", "dev"], ["db", "push"], ["db", "execute"]]) {
    const load = sourceLoader({ "prisma/config": { defineConfig: (value: unknown) => value } }, { process: { argv: ["node", "prisma", ...args] } });
    assert.throws(() => load("prisma.checkout.config.ts"), /offline schema operations only/);
  }
  const configText = readFileSync("prisma.checkout.config.ts", "utf8").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(configText, /dotenv|process\.env|env\(/);
});

test("migration changes metadata only, preserves legacy rows and declares integrity guards", () => {
  const text = readFileSync("prisma/migrations/20261017000000_checkout_v1_foundation/migration.sql", "utf8");
  const sql = text.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM|TRUNCATE|DROP\s+(?:TABLE|COLUMN|TYPE))\b/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+"Inventory"[\s\S]*?\b(?:ALTER\s+COLUMN|ADD\s+COLUMN)\b/i);
  assert.match(sql, /ALTER COLUMN "customerEmail" DROP NOT NULL/);
  for (const target of ["hidden-forest-64993760", "br-proud-field-b3xjljxh", "ep-lucky-fire-b3froe7u", "pg_stat_ssl"]) assert.ok(sql.includes(target));
  for (const name of ["Inventory_values_check", "Order_money_check", "OrderItem_values_check", "Order_shipping_snapshot_check", "CheckoutAttempt_state_check", "InventoryReservation_state_check", "InventoryReservation_quantity_check"])
    assert.ok(sql.includes(name));
  assert.match(sql, /CREATE UNIQUE INDEX "InventoryReservation_orderItemId_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "CheckoutAttempt_ownerHash_keyHash_key"/);
  assert.match(sql, /BEGIN;/); assert.match(sql, /COMMIT;/);
});
