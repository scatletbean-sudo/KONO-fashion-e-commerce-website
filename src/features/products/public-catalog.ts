import { NextResponse } from "next/server";

export type CatalogResource = "products" | "variants" | "images" | "categories" | "collections" | "sizes" | "colors";
type Row = Record<string, unknown>;

function row(value: unknown): Row {
  return value !== null && typeof value === "object" ? value as Row : {};
}

function pick(value: unknown, fields: string[]): Row {
  const source = row(value);
  return Object.fromEntries(fields.filter((key) => key in source).map((key) => [key, source[key]]));
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// Explicit allowlists: new database fields never become public automatically.
function project(resource: CatalogResource, value: unknown, nested = false): Row | null {
  const source = row(value);
  switch (resource) {
    case "products": {
      if (source.status !== "ACTIVE") return null;
      const result = pick(source, ["id", "name", "slug", "description", "shortDescription", "basePrice", "compareAtPrice", "brand", "metaTitle", "metaDescription", "publishedAt"]);
      if ("images" in source) result.images = list(source.images).map((image) => project("images", image, true));
      if ("variants" in source) result.variants = list(source.variants).map((variant) => project("variants", variant, true)).filter(Boolean);
      for (const [key, related] of [["categories", "category"], ["collections", "collection"]] as const) {
        if (key in source) result[key] = list(source[key]).flatMap((link) => {
          const item = project(key, row(link)[related], true);
          return item ? [{ [related]: item }] : [];
        });
      }
      return result;
    }
    case "variants": {
      if (source.isActive !== true || (!nested && row(source.product).status !== "ACTIVE")) return null;
      const result = pick(source, ["id", "productId", "sku", "colorId", "sizeId", "priceOverride"]);
      if ("color" in source) result.color = source.color ? project("colors", source.color, true) : null;
      if ("size" in source) result.size = source.size ? project("sizes", source.size, true) : null;
      const inventory = row(source.inventory);
      result.inStock = typeof inventory.quantity === "number" && typeof inventory.reserved === "number" && inventory.quantity > inventory.reserved;
      return result;
    }
    case "images":
      if (!nested && row(source.product).status !== "ACTIVE") return null;
      return pick(source, ["id", "productId", "url", "alt", "sortOrder", "isPrimary", "imageType", "width", "height"]);
    case "categories":
    case "collections": {
      if (source.isActive !== true) return null;
      const result = pick(source, ["id", "name", "slug", "description", "imageUrl", ...(resource === "categories" ? ["parentId"] : ["isFeatured"])]);
      if (!nested && "products" in source) result.products = list(source.products).flatMap((link) => {
        const product = project("products", row(link).product, true);
        return product ? [{ product }] : [];
      });
      if (!nested && resource === "categories") {
        if ("parent" in source) result.parent = source.parent ? project("categories", source.parent, true) : null;
        if ("children" in source) result.children = list(source.children).map((child) => project("categories", child, true)).filter(Boolean);
      }
      return result;
    }
    case "sizes":
      return pick(source, ["id", "name", "slug", "sortOrder"]);
    case "colors":
      return pick(source, ["id", "name", "slug", "hexCode"]);
  }
}

export function publicCatalogData(resource: CatalogResource, data: unknown) {
  return Array.isArray(data) ? data.map((item) => project(resource, item)).filter(Boolean) : project(resource, data);
}

export function catalogResponse(resource: CatalogResource, data: unknown) {
  const visibleData = publicCatalogData(resource, data);
  if (visibleData === null) {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ success: true, data: visibleData }, { headers: { "Cache-Control": "private, no-store" } });
}

export function catalogError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const knownError = /^(Product|Variant|Product image|Image|Category|Collection|Size|Color) (not found|ID is required)$/i.test(message);
  const status = knownError ? (message.endsWith("not found") ? 404 : 400) : 500;
  return NextResponse.json(
    { success: false, message: knownError ? message : "Failed to load catalog" },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
