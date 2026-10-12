import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { variantService } from "@/features/products/variants/services/variant.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/products/variants/[id]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminCatalogGet(async () => variantService.getVariantById((await params).id));
}
