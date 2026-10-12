import { adminCatalogGet } from "@/lib/admin/api/catalog";
import { categoryService } from "@/features/products/categories/services/category.service";

// Keep legacy ADMIN-only write handlers as compatibility aliases.
export { POST } from "@/app/api/categories/route";

export async function GET() {
  return adminCatalogGet(() => categoryService.getCategories());
}
