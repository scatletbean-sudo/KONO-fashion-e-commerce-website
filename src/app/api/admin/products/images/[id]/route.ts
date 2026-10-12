import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { productImageService } from "@/features/products/images/services/product-image.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/products/images/[id]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminCatalogGet(async () => productImageService.getImageById((await params).id));
}
