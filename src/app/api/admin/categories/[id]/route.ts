import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { categoryService } from "@/features/products/categories/services/category.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { PATCH, DELETE } from "@/app/api/categories/[id]/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminCatalogGet(async () => categoryService.getCategoryById((await params).id));
}
