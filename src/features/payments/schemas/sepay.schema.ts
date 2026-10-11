import { z } from "zod";

export function normalizeSepayCode(code: string | null): string | null {
  return code?.trim().toUpperCase() || null;
}

export const sepayWebhookSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  gateway: z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(100),
  subAccount: z.string().max(100).nullable().optional(),
  code: z.string().max(255).nullable().transform(normalizeSepayCode),
  content: z.string().max(10000),
  transferType: z.enum(["in", "out"]),
  transferAmount: z.number().int().positive().max(2147483647),
  referenceCode: z.string().max(255).nullable().optional(),
});

export type SepayWebhook = z.infer<typeof sepayWebhookSchema>;

export const PHASE_THREE_PAYMENT_CODE = "KONO-SEPAYTEST-5FC7B6FC-D190-497F-88BC-E4148967390F";

// Only newly generated phase-two codes can be authorized for public confirmation.
export function parseTestPaymentAllowlist(value: string | undefined): string[] {
  if (!value) return [];
  const codes = value.split(",").map((code) => code.trim());
  if (codes.some((code) => !/^KONO-SEPAYTEST-[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/.test(code))) return [];
  return [...new Set(codes)];
}

// Match complete tokens, preserving the existing KONO-<orderNumber> format.
export function extractPaymentCode(body: SepayWebhook): string | null {
  const tokens = body.content.toUpperCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  const codes = tokens.filter((token) => /^KONO-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(token));
  if (codes.length > 1) return null;
  const code = normalizeSepayCode(body.code);
  if (code !== null) {
    if (!/^KONO-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) return null;
    if (codes.length && codes[0] !== code) return null;
    return code;
  }
  return codes[0] ?? null;
}
