import type { Prisma } from "@/generated/prisma/client";
import type { UpdateProductInput } from "../schemas/product.schema";
import type { productRepository } from "../repositories/product.repository";
import { AttributeReferenceError } from "./attribute-errors";
import { validateAttributeReferences } from "./reference-validation";

type Product = NonNullable<Awaited<ReturnType<typeof productRepository.findById>>>;
export function validProductImage(url: string) {
  if (/^\/(?!\/)/.test(url) && !/\s/.test(url)) return true;
  try { const parsed = new URL(url); return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password; }
  catch { return false; }
}
const validPrice = (price: number) => Number.isInteger(price) && price >= 0 && price <= 2147483647;

export async function validateProductUpdate(current: Product, data: UpdateProductInput, db: Prisma.TransactionClient) {
  const incoming = data.variants ?? [];
  for (const variant of incoming) {
    if (variant.id && !current.variants.some(old => old.id === variant.id)) throw new AttributeReferenceError("variants", "A variant does not belong to this product. Reload before saving.");
  }
  const categoryIds = data.categoryIds ?? current.categories.map(link => link.categoryId);
  const collectionIds = data.collectionIds ?? current.collections.map(link => link.collectionId);
  const activating = data.status === "ACTIVE" && current.status !== "ACTIVE";
  const variants = incoming.map(variant => {
    const old = current.variants.find(item => item.id === variant.id);
    return { ...variant, isActive: variant.isActive ?? old?.isActive ?? true, colorId: old?.colorId === variant.colorId ? undefined : variant.colorId, sizeId: old?.sizeId === variant.sizeId ? undefined : variant.sizeId };
  });
  await validateAttributeReferences({
    categoryIds: activating ? categoryIds : categoryIds.filter(id => !current.categories.some(link => link.categoryId === id)),
    collectionIds: activating ? collectionIds : collectionIds.filter(id => !current.collections.some(link => link.collectionId === id)),
    variants: activating ? [...current.variants.map(variant => ({ sku: variant.sku, isActive: variant.isActive, colorId: variant.colorId ?? undefined, sizeId: variant.sizeId ?? undefined })), ...variants] : variants,
  }, db, true);
  if (!activating) return;
  if (incoming.some(variant => variant.inventory !== undefined)) throw new AttributeReferenceError("variants", "Adjust inventory separately before activating this product.");
  if (!categoryIds.length) throw new AttributeReferenceError("categoryIds", "Activation requires at least one active category.");
  const images = data.images ?? current.images;
  if (!images.some(image => validProductImage(image.url))) throw new AttributeReferenceError("status", "Activation requires at least one valid product image.");
  const basePrice = data.basePrice ?? current.basePrice;
  if (!validPrice(basePrice)) throw new AttributeReferenceError("basePrice", "Activation requires a valid whole VND selling price.");
  const merged = current.variants.map(old => ({ ...old, ...Object.fromEntries(Object.entries(incoming.find(variant => variant.id === old.id) ?? {}).filter(([, value]) => value !== undefined)) }));
  const additions = incoming.filter(variant => !variant.id).map(variant => ({ ...variant, isActive: variant.isActive ?? true, inventory: null }));
  const active = [...merged, ...additions].filter(variant => variant.isActive && validPrice(variant.priceOverride ?? basePrice));
  if (!active.length) throw new AttributeReferenceError("status", "Activation requires an enabled variant with a valid price.");
  const available = active.some(variant => variant.inventory && Number.isInteger(variant.inventory.quantity) && Number.isInteger(variant.inventory.reserved)
    && variant.inventory.reserved >= 0 && variant.inventory.quantity - variant.inventory.reserved > 0);
  if (!available) throw new AttributeReferenceError("status", "Activation requires an enabled variant with available inventory greater than zero.");
}
