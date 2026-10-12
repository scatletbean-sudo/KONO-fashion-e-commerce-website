import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { inventoryService } from "@/features/inventory/services/inventory.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/inventory/route";

export async function GET() {
  return adminCatalogGet(() => inventoryService.getInventories());
}
