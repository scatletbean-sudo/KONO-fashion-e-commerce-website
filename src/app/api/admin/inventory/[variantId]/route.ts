import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { inventoryService } from "@/features/inventory/services/inventory.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/inventory/[variantId]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ variantId: string }> }) {
  return adminCatalogGet(async () => inventoryService.getInventoryByVariantId((await params).variantId));
}
