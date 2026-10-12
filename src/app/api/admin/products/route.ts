import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { productService } from "@/features/products/services/product.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/products/route";

export async function GET() {
  return adminCatalogGet(() => productService.getProducts());
}
