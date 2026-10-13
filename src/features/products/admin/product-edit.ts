import { z } from "zod";
import { updateProductSchema } from "../schemas/product.schema";
import { productFormFields, type DraftForm, type CatalogOption } from "./product-management";
import { selectableAttributes } from "./attribute-management";
import type { AttributeResource } from "./product-management";
import { imageTypeSchema } from "../images/media-policy";

const option = z.object({ id: z.string(), name: z.string(), isActive: z.boolean().optional() });
export const editableProductSchema = z.object({
  id: z.string(), name: z.string(), slug: z.string(), description: z.string().nullable(), basePrice: z.number(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  categories: z.array(z.object({ categoryId: z.string(), category: option })),
  collections: z.array(z.object({ collectionId: z.string(), collection: option })),
  images: z.array(z.object({ id: z.string(), url: z.string(), alt: z.string().nullable(), sortOrder: z.number(), isPrimary: z.boolean(), imageType: imageTypeSchema.optional() })),
  variants: z.array(z.object({ id: z.string(), sku: z.string(), colorId: z.string().nullable(), sizeId: z.string().nullable(),
    color: option.nullable(), size: option.nullable(), priceOverride: z.number().nullable(), isActive: z.boolean(),
    inventory: z.object({ quantity: z.number(), reserved: z.number() }).nullable(),
  })),
});
export type EditableProduct = z.infer<typeof editableProductSchema>;
export function productFormValues(product: EditableProduct): DraftForm {
  return { name: product.name, slug: product.slug, description: product.description ?? "", basePrice: String(product.basePrice),
    categoryIds: product.categories.map(link => link.categoryId), collectionIds: product.collections.map(link => link.collectionId),
    images: [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map(image => ({ url: image.url, alt: image.alt ?? "" })),
    variants: product.variants.map(variant => ({ sku: variant.sku, colorId: variant.colorId ?? "", sizeId: variant.sizeId ?? "", priceOverride: variant.priceOverride === null ? "" : String(variant.priceOverride) })),
  };
}
export function productAttributeOptions(resource: AttributeResource, available: CatalogOption[], product?: EditableProduct) {
  const active = selectableAttributes(resource, available);
  if (!product) return active;
  const current = resource === "categories" ? product.categories.map(link => link.category)
    : resource === "collections" ? product.collections.map(link => link.collection)
    : product.variants.flatMap(variant => { const item = resource === "colors" ? variant.color : variant.size; return item ? [item] : []; });
  // Retain current inactive values, while not making other inactive entries selectable.
  const missing = current.filter(item => !active.some(option => option.id === item.id));
  return [...active, ...missing.filter((item, index) => missing.findIndex(other => other.id === item.id) === index)];
}
export function parseProductEdit(form: DraftForm, status: EditableProduct["status"], product: EditableProduct) {
  const schema = productFormFields.omit({ images: true }).superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.variants.forEach((variant, index) => {
      const old = product.variants[index];
      if (seen.has(variant.sku)) ctx.addIssue({ code: "custom", path: ["variants", index, "sku"], message: "Each variant needs a unique SKU." });
      seen.add(variant.sku);
      if (old?.colorId && !variant.colorId) ctx.addIssue({ code: "custom", path: ["variants", index, "colorId"], message: "Clearing an existing color is not available. Choose another color or keep the current one." });
      if (old?.sizeId && !variant.sizeId) ctx.addIssue({ code: "custom", path: ["variants", index, "sizeId"], message: "Clearing an existing size is not available. Choose another size or keep the current one." });
      if (old?.priceOverride !== null && old?.priceOverride !== undefined && variant.priceOverride === undefined) ctx.addIssue({ code: "custom", path: ["variants", index, "priceOverride"], message: "Clearing an existing variant price is not available. Enter a price or keep the current one." });
    });
  }).transform(data => {
    const patch: Record<string, unknown> = { id: product.id };
    if (data.name !== product.name) patch.name = data.name;
    if (data.slug !== product.slug) patch.slug = data.slug;
    if (data.description !== (product.description ?? "")) patch.description = data.description;
    if (data.basePrice !== product.basePrice) patch.basePrice = data.basePrice;
    if (status !== product.status) patch.status = status;
    const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));
    if (!sameIds(data.categoryIds, product.categories.map(link => link.categoryId))) patch.categoryIds = data.categoryIds;
    if (!sameIds(data.collectionIds, product.collections.map(link => link.collectionId))) patch.collectionIds = data.collectionIds;
    const variants = data.variants.flatMap((variant, index) => {
      const old = product.variants[index];
      const changed = !old || variant.sku !== old.sku || variant.colorId !== (old.colorId ?? "") || variant.sizeId !== (old.sizeId ?? "") || variant.priceOverride !== (old.priceOverride ?? undefined);
      return changed ? [{ ...variant, ...(old ? { id: old.id, isActive: old.isActive } : { isActive: true }), colorId: variant.colorId || undefined, sizeId: variant.sizeId || undefined }] : [];
    });
    if (variants.length) patch.variants = variants;
    return patch;
  });
  const parsed = schema.safeParse(form);
  if (!parsed.success || Object.keys(parsed.data).length === 1) return parsed;
  return updateProductSchema.safeParse(parsed.data);
}
