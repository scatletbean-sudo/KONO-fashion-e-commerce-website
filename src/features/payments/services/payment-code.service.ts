export const paymentCodeService = {
  generate(orderNumber: string) {
    const normalized = orderNumber
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");

    if (!normalized) {
      throw new Error("Invalid order number");
    }

    return `KONO-${normalized}`;
  },
};