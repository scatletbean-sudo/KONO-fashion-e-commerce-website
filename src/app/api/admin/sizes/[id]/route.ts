import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { sizeService } from "@/features/products/sizes/services/size.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/sizes/[id]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminCatalogGet(async () => sizeService.getSizeById((await params).id));
}
