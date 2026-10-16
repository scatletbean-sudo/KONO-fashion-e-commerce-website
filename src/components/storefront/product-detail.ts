import type { StorefrontProduct } from "./catalog";
export type ProductPhoto = StorefrontProduct["images"][number];
const priority = ["FRONT_VIEW", "BACK_VIEW", "LEFT_VIEW", "RIGHT_VIEW", "DETAIL", "ON_MODEL", "MULTI_VIEW", "PRODUCT", "LIFESTYLE"];
export function productPhotos(images: ProductPhoto[]) {
  return [...images].filter(image => image.imageType !== "SIZE_CHART").sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || priority.indexOf(a.imageType ?? "PRODUCT") - priority.indexOf(b.imageType ?? "PRODUCT"));
}
export function variantPrice(product: StorefrontProduct, variant: StorefrontProduct["variants"][number] | null) {
  const price = variant ? variant.priceOverride ?? product.basePrice : null;
  return price !== null && Number.isSafeInteger(price) && price >= 0 ? price : null;
}
