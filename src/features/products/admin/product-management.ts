import { z } from "zod";
import { createProductSchema, productVariantSchema } from "../schemas/product.schema";

export const productListSchema = z.array(z.object({
  id: z.string(), name: z.string(), slug: z.string(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]), basePrice: z.number(),
  images: z.array(z.object({ url: z.string(), alt: z.string().nullable().optional(), isPrimary: z.boolean(), sortOrder: z.number() })),
  categories: z.array(z.object({ categoryId: z.string() })).optional(),
  collections: z.array(z.object({ collectionId: z.string() })).optional(),
  variants: z.array(z.object({
    colorId: z.string().nullable().optional(), sizeId: z.string().nullable().optional(),
    inventory: z.object({ quantity: z.number(), reserved: z.number() }).nullable(),
  })),
}));
export type AdminProduct = z.infer<typeof productListSchema>[number];
export const optionListSchema = z.array(z.object({ id: z.string(), name: z.string(), isActive: z.boolean().optional() }));
export type CatalogOption = z.infer<typeof optionListSchema>[number];
export const attributeResources = ["categories", "collections", "colors", "sizes"] as const;
export type AttributeResource = typeof attributeResources[number];
export const attributeListSchema = z.array(optionListSchema.element.extend({
  slug: z.string(), description: z.string().nullable().optional(),
  hexCode: z.string().nullable().optional(), sortOrder: z.number().optional(),
  isFeatured: z.boolean().optional(),
}));
export type CatalogAttribute = z.infer<typeof attributeListSchema>[number];
export type AttributeCatalog = Record<AttributeResource, CatalogAttribute[]>;
export type ProductFilters = { categoryId: string; collectionId: string; colorId: string; sizeId: string };
export const emptyProductFilters: ProductFilters = { categoryId: "", collectionId: "", colorId: "", sizeId: "" };

const price = z.string().trim().regex(/^\d+$/, "Enter a whole VND amount (0 or more).")
  .transform(Number).refine(n => n <= 2147483647, "Price must not exceed 2,147,483,647 VND.");
const optionalPrice = z.union([z.literal(""), price]).transform(value => value === "" ? undefined : value);
const imageUrl = z.string().trim().url("Enter a valid image URL.").refine(value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}, "Use an HTTP or HTTPS image URL without credentials.");

export const productFormFields = z.object({
  name: createProductSchema.shape.name, slug: createProductSchema.shape.slug,
  description: z.string(), basePrice: price,
  categoryIds: z.array(z.string()), collectionIds: z.array(z.string()),
  images: z.array(z.object({ url: imageUrl, alt: z.string().trim().max(255, "Alt text is too long.") })),
  variants: z.array(z.object({
    sku: productVariantSchema.shape.sku,
    colorId: z.string(), sizeId: z.string(), priceOverride: optionalPrice,
  })),
});
export const draftFormSchema = productFormFields.superRefine((data, ctx) => {
  if (data.images.length) ctx.addIssue({ code: "custom", path: ["images"], message: "Save the draft first, then upload images in Media Manager." });
  const skus = new Set<string>();
  const combinations = new Set<string>();
  data.variants.forEach((variant, index) => {
    if (skus.has(variant.sku)) ctx.addIssue({ code: "custom", path: ["variants", index, "sku"], message: "Each variant needs a unique SKU." });
    skus.add(variant.sku);
    const combination = JSON.stringify([variant.colorId, variant.sizeId]);
    if (combinations.has(combination)) ctx.addIssue({ code: "custom", path: ["variants", index, "sizeId"], message: "This color and size combination already exists." });
    combinations.add(combination);
  });
}).transform(data => createProductSchema.parse({
  ...data, status: "DRAFT",
  images: data.images.map((image, index) => ({ ...image, sortOrder: index, isPrimary: index === 0 })),
  variants: data.variants.map(variant => ({
    sku: variant.sku, colorId: variant.colorId || undefined, sizeId: variant.sizeId || undefined,
    priceOverride: variant.priceOverride, isActive: true,
  })),
}));
export type DraftForm = z.input<typeof draftFormSchema>;
export const emptyDraft: DraftForm = { name: "", slug: "", description: "", basePrice: "", categoryIds: [], collectionIds: [], images: [], variants: [] };

export function makeSlug(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200).replace(/-$/, "");
}
export function filterProducts(products: AdminProduct[], search: string, status: string, filters: ProductFilters = emptyProductFilters) {
  const query = search.trim().toLocaleLowerCase();
  return products.filter(product => (status === "ALL" || product.status === status)
    && `${product.name} ${product.slug}`.toLocaleLowerCase().includes(query)
    && (!filters.categoryId || product.categories?.some(relation => relation.categoryId === filters.categoryId))
    && (!filters.collectionId || product.collections?.some(relation => relation.collectionId === filters.collectionId))
    && ((!filters.colorId && !filters.sizeId) || product.variants.some(variant =>
      (!filters.colorId || variant.colorId === filters.colorId) && (!filters.sizeId || variant.sizeId === filters.sizeId))));
}
export function inventorySummary(product: AdminProduct) {
  const inventories = product.variants.flatMap(variant => variant.inventory ? [variant.inventory] : []);
  if (!inventories.length) return "Not tracked";
  const available = inventories.reduce((sum, inventory) => sum + Math.max(0, inventory.quantity - inventory.reserved), 0);
  const missing = product.variants.length - inventories.length;
  return `${available} available${missing ? ` · ${missing} variant(s) not tracked` : ""}`;
}
export function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

export class CatalogApiError extends Error {
  constructor(message: string, public fieldErrors: Record<string, string[]> = {}) { super(message); }
}
export async function catalogRequest<T>(url: string, schema: z.ZodType<T>, init: RequestInit = {}, request: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try { response = await request(url, { ...init, credentials: "same-origin", cache: "no-store" }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new CatalogApiError("Cannot connect. Check your connection and try again.");
  }
  const body = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) throw new CatalogApiError("Your admin session has expired or access is denied. Sign in again.");
  if (!response.ok || body?.success !== true) {
    const messages: Record<string, string> = {
      "Product slug already exists": "This slug is already in use. Choose another slug.",
      "Invalid product data": "Some product details are invalid. Check the form below.",
      "Failed to create product": "Could not save the product. Check the slug, SKU and selected options before trying again.",
      "Failed to update product": "Could not save changes. Check the slug, SKU and selected attributes, then try again.",
      "Product not found": "This product was not found. Return to All Products and try again.",
      "This record is referenced by other data and cannot be deleted. Reload attributes; set Category or Collection Inactive instead.": "This record is referenced by other data and cannot be deleted. Reload attributes; set Category or Collection Inactive instead.",
      "This record no longer exists. Reload attributes before trying again.": "This record no longer exists. Reload attributes before trying again.",
      "Data changed during saving or the save timed out. Reload and try again.": "Data changed during saving or the save timed out. Reload and try again.",
      "An attribute slug or product SKU already exists.": "This slug or SKU is already in use. Choose another value.",
    };
    if (typeof body?.message === "string" && /^(Category|Collection|Color|Size) (name|slug) already exists$/.test(body.message)) messages[body.message] = body.message;
    const deletionMessages = ["Category is in use by products or child categories. Deactivate it instead.", "Collection is in use by products. Deactivate it instead.", "Color is in use by variants and cannot be deleted.", "Size is in use by variants and cannot be deleted."];
    if (deletionMessages.includes(body?.message)) messages[body.message] = body.message.replace("Deactivate it instead.", "Cancel, close the Edit form and choose Set Inactive instead.");
    if (typeof body?.message === "string" && /^(Category|Collection|Color|Size) not found$/.test(body.message)) messages[body.message] = "This attribute no longer exists. Cancel and reload attributes.";
    if (typeof body?.message === "string" && /^(Category|Collection|Color|Size) selection contains an unavailable/.test(body.message)) messages[body.message] = body.message;
    if (typeof body?.message === "string" && /^Activation requires|^Adjust inventory separately|^A variant does not belong/.test(body.message)) messages[body.message] = body.message;
    if (typeof body?.message === "string" && /^Invalid (category|collection|color|size) data$|^Validation failed$/.test(body.message)) messages[body.message] = "Check the highlighted attribute fields and try again.";
    const errors = z.record(z.string(), z.array(z.string())).safeParse(body?.errors?.fieldErrors);
    throw new CatalogApiError(messages[body?.message] ?? "Could not complete the request. Please try again.", errors.success ? errors.data : {});
  }
  const result = schema.safeParse(body.data);
  if (!result.success) throw new CatalogApiError("The server returned an unexpected response. Reload and try again.");
  return result.data;
}
