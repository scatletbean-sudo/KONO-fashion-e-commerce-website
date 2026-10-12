import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { sizeService } from "@/features/products/sizes/services/size.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/sizes/route";

export async function GET() {
  return adminCatalogGet(() => sizeService.getSizes());
}
