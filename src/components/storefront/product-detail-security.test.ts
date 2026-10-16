import assert from "node:assert/strict";
import test from "node:test";
import { sourceLoader } from "@/lib/testing/load-source";
import { publicCatalogData } from "@/features/products/public-catalog";

for (const status of ["DRAFT", "ARCHIVED"]) {
  test(`PDP and public APIs hide ${status} even with an admin cookie`, async () => {
    const hidden = { id: "hidden", name: "UNPUBLISHED_PRIVATE_NAME", slug: "hidden", status, basePrice: 918273, images: [{ id: "i", url: "https://private.example/SECRET_IMAGE.jpg" }], variants: [{ id: "v", isActive: true, costPrice: 812737, inventory: { quantity: 99, reserved: 1 } }] };
    const load = sourceLoader({
      "@/features/products/services/product.service": { productService: { getProducts: async () => [hidden], getProductById: async () => hidden } },
      "@/features/products/schemas/product.schema": {},
      "@/lib/admin/api/attribute-errors": {},
      "@/lib/auth/admin-guard": { getAdminSession: async () => ({ user: { role: "ADMIN" } }) },
      "@/components/storefront/server-catalog": { getServerCatalog: async () => publicCatalogData("products", [hidden]) },
      "@/components/storefront/ProductDetail": { __esModule: true, default: () => null },
      "@/components/storefront/StorefrontShell": { StorefrontHeader: () => null, StorefrontFooter: () => null },
      "@/components/storefront/storefront.module.css": { __esModule: true, default: {} },
      "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
    });
    type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
    for (const file of ["src/app/api/products/route.ts", "src/app/api/products/[id]/route.ts"]) {
      const response = await (load(file).GET as Handler)(new Request("https://kono.test/api/products/hidden", { headers: { Cookie: "kono_session=synthetic" } }), { params: Promise.resolve({ id: "hidden" }) });
      assert.equal(response.status, file.includes("[id]") ? 404 : 200);
      const body = JSON.stringify(await response.json());
      for (const value of ["UNPUBLISHED_PRIVATE_NAME", "SECRET_IMAGE", "918273", "812737", "reserved"]) assert.equal(body.includes(value), false);
    }
    const page = load("src/app/products/[slug]/page.tsx").default as (props: { params: Promise<{ slug: string }> }) => Promise<unknown>;
    await assert.rejects(page({ params: Promise.resolve({ slug: "hidden" }) }), /NOT_FOUND/);
  });
}
