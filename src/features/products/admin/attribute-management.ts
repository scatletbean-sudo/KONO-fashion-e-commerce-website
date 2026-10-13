import { createCategorySchema } from "../categories/schemas/category.schema";
import { createCollectionSchema } from "../collections/schemas/collection.schema";
import { createColorSchema } from "../colors/schemas/color.schema";
import { createSizeSchema } from "../sizes/schemas/size.schema";
import { type AttributeResource, type CatalogAttribute, type CatalogOption } from "./product-management";

export type AttributeFormValues = {
  name: string; slug: string; description: string; hexCode: string; sortOrder: string; isActive: boolean;
};
export const emptyAttributeForm: AttributeFormValues = { name: "", slug: "", description: "", hexCode: "", sortOrder: "0", isActive: true };
export function attributeFormValues(attribute?: CatalogAttribute): AttributeFormValues {
  return attribute ? { name: attribute.name, slug: attribute.slug, description: attribute.description ?? "", hexCode: attribute.hexCode ?? "", sortOrder: String(attribute.sortOrder ?? 0), isActive: attribute.isActive ?? true } : { ...emptyAttributeForm };
}
export function parseAttributeForm(resource: AttributeResource, form: AttributeFormValues) {
  const basic = { name: form.name, slug: form.slug };
  switch (resource) {
    case "categories": return createCategorySchema.pick({ name: true, slug: true, description: true, isActive: true }).safeParse({ ...basic, description: form.description, isActive: form.isActive });
    case "collections": return createCollectionSchema.pick({ name: true, slug: true, description: true, isActive: true }).safeParse({ ...basic, description: form.description, isActive: form.isActive });
    case "colors": return createColorSchema.safeParse({ ...basic, hexCode: form.hexCode.trim() || null });
    case "sizes": return createSizeSchema.safeParse({ ...basic, sortOrder: /^\d+$/.test(form.sortOrder.trim()) ? Number(form.sortOrder) : NaN });
  }
}
export function attributeConflict(items: CatalogAttribute[], name: string, slug: string, id?: string) {
  const others = items.filter(item => item.id !== id);
  if (others.some(item => item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) return { field: "name", message: "This name is already in use in this group." };
  if (others.some(item => item.slug === slug.trim())) return { field: "slug", message: "This slug is already in use in this group." };
  return null;
}
export function selectableAttributes(resource: AttributeResource, options: CatalogOption[]) {
  // The current Color/Size models have no Active/Inactive state.
  return options.filter(option => resource === "categories" || resource === "collections" ? option.isActive === true : option.isActive !== false);
}
