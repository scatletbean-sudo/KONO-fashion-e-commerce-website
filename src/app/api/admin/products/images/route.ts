import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { productImageService } from "@/features/products/images/services/product-image.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/products/images/route";

export async function GET(request: Request) {
  return adminCatalogGet(async () => {
    const productId = new URL(request.url).searchParams.get("productId");
    return productId ? productImageService.getImagesByProductId(productId) : productImageService.getImages();
  });
}
