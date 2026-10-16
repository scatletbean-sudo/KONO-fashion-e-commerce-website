import assert from "node:assert/strict";
import test from "node:test";
import { productPhotos, variantPrice, type ProductPhoto } from "./product-detail";
import type { StorefrontProduct } from "./catalog";
const image = (id: string, sortOrder: number, imageType: ProductPhoto["imageType"] = "FRONT_VIEW", isPrimary = false): ProductPhoto => ({ id, sortOrder, imageType, isPrimary, url: `/real-${id}.jpg` });
test("PDP keeps primary first, preserves manual order, excludes charts and never mutates originals", () => {
  const images = [image("back", 2, "BACK_VIEW"), image("chart", 0, "SIZE_CHART", true), image("front", 1), image("detail", 3, "DETAIL", true)];
  assert.deepEqual(productPhotos(images).map(x => x.id), ["detail", "front", "back"]);
  assert.deepEqual(images.map(x => x.id), ["back", "chart", "front", "detail"]);
  assert.deepEqual(productPhotos([]), []);
});
test("PDP uses preferred view type to break equal ordering", () => {
  assert.deepEqual(productPhotos([image("multi", 0, "MULTI_VIEW"), image("front", 0)]).map(x => x.id), ["front", "multi"]);
});
test("PDP never invents a variant price and rejects invalid numbers", () => {
  const product = { basePrice: 425000 } as StorefrontProduct;
  assert.equal(variantPrice(product, null), null);
  assert.equal(variantPrice(product, { priceOverride: 520000 } as StorefrontProduct["variants"][number]), 520000);
  assert.equal(variantPrice(product, { priceOverride: null } as StorefrontProduct["variants"][number]), 425000);
  for (const priceOverride of [NaN, Infinity, -1, 1.5]) assert.equal(variantPrice(product, { priceOverride } as StorefrontProduct["variants"][number]), null);
});
