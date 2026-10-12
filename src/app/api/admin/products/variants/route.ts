import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { variantService } from "@/features/products/variants/services/variant.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/products/variants/route";

export async function GET(request: Request) {
  return adminCatalogGet(async () => {
    const productId = new URL(request.url).searchParams.get("productId");
    return productId ? variantService.getVariantsByProductId(productId) : variantService.getVariants();
  });
}
