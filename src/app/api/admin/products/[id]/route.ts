import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { productService } from "@/features/products/services/product.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/products/[id]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminCatalogGet(async () => productService.getProductById((await params).id));
}
