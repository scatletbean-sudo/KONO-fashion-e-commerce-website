import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { colorService } from "@/features/products/colors/services/color.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/colors/route";

export async function GET() {
  return adminCatalogGet(() => colorService.getColors());
}
