import assert from "node:assert/strict";
import test from "node:test";
import { catalogSchema, filterProducts, matchingVariants, productPrice, readFilters } from "./catalog";

const products = catalogSchema.parse({ success: true, data: [
  { id: "p1", name: "Denim", slug: "denim", basePrice: 200, images: [], categories: [{ category: { id: "cat", name: "Denim", slug: "denim" } }], collections: [{ collection: { id: "drop", name: "Drop", slug: "drop" } }], variants: [
    { id: "v1", inStock: false, priceOverride: 100, color: { id: "black", name: "Black" }, size: { id: "m", name: "M" }, costPrice: 50 },
    { id: "v2", inStock: true, priceOverride: 300, color: { id: "blue", name: "Blue" }, size: { id: "l", name: "L" } },
  ] },
  { id: "p2", name: "Cargo", slug: "cargo", basePrice: 150, images: [], variants: [{ id: "v3", inStock: true, priceOverride: 0 }] },
] }).data;

test("public schema strips private fields and preserves variant options", () => {
  assert.equal(JSON.stringify(products).includes("costPrice"), false);
  assert.equal(products[0].variants[0].color?.name, "Black");
  assert.equal(productPrice(products[1]), 0);
});
test("color and size filters must match the same variant", () => {
  assert.equal(filterProducts(products, readFilters(new URLSearchParams("color=black&size=l"))).length, 0);
  assert.equal(filterProducts(products, readFilters(new URLSearchParams("color=black&size=m"))).length, 1);
  assert.equal(filterProducts(products, readFilters(new URLSearchParams("color=blue&size=l&max=200"))).length, 0);
});
test("filter state round-trips through shareable URL params", () => {
  const filters = readFilters(new URLSearchParams("q=den&category=denim&collection=drop&min=50&max=100&sort=price-desc"));
  assert.deepEqual(filterProducts(products, filters).map((product) => product.id), ["p1"]);
  assert.equal(readFilters(new URLSearchParams("sort=invalid")).sort, "newest");
  assert.equal(filterProducts(products, readFilters(new URLSearchParams("min=500&max=50"))).length, 0);
});
test("sorting is stable for newest and does not mutate API data", () => {
  assert.deepEqual(filterProducts(products, readFilters(new URLSearchParams())).map((product) => product.id), ["p1", "p2"]);
  assert.deepEqual(filterProducts(products, readFilters(new URLSearchParams("sort=price-asc"))).map((product) => product.id), ["p2", "p1"]);
  assert.deepEqual(filterProducts(products, readFilters(new URLSearchParams("sort=name"))).map((product) => product.id), ["p2", "p1"]);
  assert.equal(products[0].id, "p1");
});
test("detail only resolves exact existing color/size combinations", () => {
  assert.equal(matchingVariants(products[0], "black", "l").length, 0);
  const selected = matchingVariants(products[0], "blue", "l")[0];
  assert.equal(selected.priceOverride, 300);
  assert.equal(selected.inStock, true);
  assert.equal(matchingVariants(products[0], "black", "m")[0].inStock, false);
  assert.equal(matchingVariants(products[1], "", "").length, 1);
});
test("an empty catalog remains an empty catalog rather than fake products", () => {
  assert.deepEqual(catalogSchema.parse({ success: true, data: [] }).data, []);
  assert.equal(catalogSchema.safeParse({ success: false }).success, false);
});
