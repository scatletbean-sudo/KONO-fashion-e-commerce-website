import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { CartError, stockLimit, type CartSnapshot } from "./cart-contract";
const variantSelect = { id: true, productId: true, priceOverride: true, isActive: true, color: { select: { name: true } }, size: { select: { name: true } }, inventory: { select: { quantity: true, reserved: true, lowStockAt: true } }, product: { select: { id: true, status: true, basePrice: true, name: true, slug: true, images: { where: { isPrimary: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1, select: { url: true } } } } } satisfies Prisma.ProductVariantSelect;
type Variant = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;
type Db = Prisma.TransactionClient;
function priceOf(variant: Variant) {
  const price = variant.priceOverride ?? variant.product.basePrice;
  if (!Number.isSafeInteger(price) || price <= 0) throw new CartError("Giá của phiên bản này chưa khả dụng.", 409);
  return price;
}
async function visibleVariant(db: Db, variantId: string) {
  const variant = await db.productVariant.findFirst({ where: { id: variantId, isActive: true, product: { status: "ACTIVE" } }, select: variantSelect });
  if (!variant || variant.product.status !== "ACTIVE" || !variant.isActive) throw new CartError("Không tìm thấy phiên bản khả dụng.", 404);
  return variant;
}
async function snapshot(db: Db, sessionId: string): Promise<CartSnapshot> {
  const cart = await db.cart.findUnique({ where: { sessionId }, include: { items: { where: { product: { status: "ACTIVE" }, variant: { isActive: true, product: { status: "ACTIVE" } } }, include: { variant: { select: variantSelect } }, orderBy: { createdAt: "asc" } } } });
  return { items: (cart?.items ?? []).flatMap(item => {
    const variant = item.variant;
    if (variant.product.status !== "ACTIVE" || !variant.isActive || item.productId !== variant.productId) return [];
    try { return [{ variantId: variant.id, productId: variant.productId, name: variant.product.name, slug: variant.product.slug, imageUrl: variant.product.images?.[0]?.url ?? null, color: variant.color?.name ?? null, size: variant.size?.name ?? null, quantity: item.quantity, price: priceOf(variant), maxQuantity: stockLimit(variant.inventory) }]; } catch { return []; }
  }) };
}
export const cartService = {
  async read(sessionId: string | null) { return sessionId ? snapshot(prisma, sessionId) : { items: [] }; },
  async availability(variantId: string, sessionId: string | null) {
    const variant = await visibleVariant(prisma, variantId);
    const cart = sessionId ? await prisma.cart.findUnique({ where: { sessionId }, select: { items: { where: { variantId }, select: { quantity: true } } } }) : null;
    const maxQuantity = stockLimit(variant.inventory);
    return { variantId: variant.id, price: priceOf(variant), maxQuantity, currentQuantity: cart?.items[0]?.quantity ?? 0, inStock: maxQuantity > 0, lowStock: maxQuantity > 0 && Number.isSafeInteger(variant.inventory?.lowStockAt) && variant.inventory!.lowStockAt > 0 && variant.inventory!.quantity - variant.inventory!.reserved <= variant.inventory!.lowStockAt };
  },
  async setQuantity(sessionId: string, variantId: string, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99) throw new CartError("Số lượng không hợp lệ.");
    return prisma.$transaction(async tx => {
      const cart = await tx.cart.upsert({ where: { sessionId }, create: { sessionId }, update: {} });
      await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id} FOR UPDATE`;
      if (quantity === 0) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
      } else {
        // Match the existing product-edit lock order. Recheck after locks before any item write.
        const initial = await visibleVariant(tx, variantId);
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${initial.productId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "Inventory" WHERE "variantId" = ${variantId} FOR SHARE`;
        const variant = await visibleVariant(tx, variantId);
        priceOf(variant);
        if (quantity > stockLimit(variant.inventory)) throw new CartError("Số lượng vượt quá tồn kho khả dụng. Vui lòng chọn lại.", 409);
        const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
        if (!existing && await tx.cartItem.count({ where: { cartId: cart.id } }) >= 50) throw new CartError("Giỏ hàng đã đạt giới hạn số phiên bản.", 409);
        await tx.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId } }, create: { cartId: cart.id, productId: variant.productId, variantId, quantity }, update: { quantity } });
      }
      return snapshot(tx, sessionId);
    });
  },
};
