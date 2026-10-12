import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { colorService } from "@/features/products/colors/services/color.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/colors/[id]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminCatalogGet(async () => colorService.getColorById((await params).id));
}
