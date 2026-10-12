import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { collectionService } from "@/features/products/collections/services/collection.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/collections/route";

export async function GET() {
  return adminCatalogGet(() => collectionService.getCollections());
}
