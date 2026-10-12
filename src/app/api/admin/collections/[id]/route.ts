import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { collectionService } from "@/features/products/collections/services/collection.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/collections/[id]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminCatalogGet(async () => collectionService.getCollectionById((await params).id));
}
