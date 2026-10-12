import { z } from "zod";

// ACTIVE products and active variants are filtered by the public API.
// Administrative status fields are intentionally absent from its contract.
const optionSchema = z.object({ id: z.string(), name: z.string(), slug: z.string().optional(), hexCode: z.string().nullable().optional(), sortOrder: z.number().optional() });
export const productSchema = z.object({
    id: z.string(), name: z.string(), slug: z.string(), basePrice: z.number().int().nonnegative(),
    compareAtPrice: z.number().int().nonnegative().nullable().optional(),
    images: z.array(z.object({ id: z.string(), url: z.string(), alt: z.string().nullable().optional(), sortOrder: z.number(), isPrimary: z.boolean() })),
    variants: z.array(z.object({ id: z.string(), sku: z.string().optional(), priceOverride: z.number().int().nonnegative().nullable().optional(), inStock: z.boolean(), color: optionSchema.nullable().optional(), size: optionSchema.nullable().optional() })),
    description: z.string().nullable().optional(), shortDescription: z.string().nullable().optional(),
    metaTitle: z.string().nullable().optional(), metaDescription: z.string().nullable().optional(),
    categories: z.array(z.object({ category: optionSchema })).default([]),
    collections: z.array(z.object({ collection: optionSchema })).default([]),
  });
export const catalogSchema = z.object({ success: z.literal(true), data: z.array(productSchema) });
export type StorefrontProduct = z.infer<typeof catalogSchema>["data"][number];

export function productPrice(product: StorefrontProduct) {
  const prices = product.variants.map((variant) => variant.priceOverride ?? product.basePrice);
  return prices.length ? Math.min(...prices) : product.basePrice;
}

export type ShopFilters = { q: string; category: string; collection: string; color: string; size: string; min: string; max: string; sort: string };
export function readFilters(params: URLSearchParams): ShopFilters {
  const value = (key: string) => params.get(key) ?? "";
  return { q: value("q"), category: value("category"), collection: value("collection"), color: value("color"), size: value("size"), min: value("min"), max: value("max"), sort: ["price-asc", "price-desc", "name"].includes(value("sort")) ? value("sort") : "newest" };
}
export function filterProducts(products: StorefrontProduct[], filters: ShopFilters) {
  const min = filters.min !== "" && Number.isFinite(Number(filters.min)) ? Math.max(0, Number(filters.min)) : 0;
  const max = filters.max !== "" && Number.isFinite(Number(filters.max)) ? Math.max(0, Number(filters.max)) : Infinity;
  const candidates = products.filter((product) => {
    if (!product.name.toLocaleLowerCase("vi").includes(filters.q.trim().toLocaleLowerCase("vi"))) return false;
    if (filters.category && !product.categories.some((link) => link.category.slug === filters.category)) return false;
    if (filters.collection && !product.collections.some((link) => link.collection.slug === filters.collection)) return false;
    const variants = product.variants.filter((variant) => (!filters.color || variant.color?.id === filters.color) && (!filters.size || variant.size?.id === filters.size));
    if ((filters.color || filters.size) && !variants.length) return false;
    const prices = variants.length ? variants.map((variant) => variant.priceOverride ?? product.basePrice) : [product.basePrice];
    return prices.some((price) => price >= min && price <= max);
  });
  return [...candidates].sort((a, b) => filters.sort === "price-asc" ? productPrice(a) - productPrice(b) : filters.sort === "price-desc" ? productPrice(b) - productPrice(a) : filters.sort === "name" ? a.name.localeCompare(b.name, "vi") : 0);
}

export function matchingVariants(product: StorefrontProduct, color: string, size: string) {
  return product.variants.filter((variant) => (variant.color?.id ?? "") === color && (variant.size?.id ?? "") === size);
}
