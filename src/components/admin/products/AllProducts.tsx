"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { attributeListSchema, attributeResources, emptyProductFilters, filterProducts, formatPrice, inventorySummary, catalogRequest, productListSchema, type AdminProduct, type AttributeCatalog, type AttributeResource } from "@/features/products/admin/product-management";
import ManageAttributes, { attributeLabels } from "./ManageAttributes";

function Thumbnail({ product }: { product: AdminProduct }) {
  const [failed, setFailed] = useState(false);
  const image = [...product.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0];
  return <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-center text-[10px] text-neutral-400">
    {image && !failed ? /* External catalog URLs are not restricted to Next image domains. */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image.url} alt={image.alt || product.name} className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : "No image"}
  </div>;
}
function Status({ status }: { status: AdminProduct["status"] }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : status === "DRAFT" ? "bg-amber-50 text-amber-800" : "bg-neutral-100 text-neutral-600"}`}>{status}</span>;
}
export default function AllProducts({ initialTab = "products", initialGroup }: { initialTab?: "products" | "attributes"; initialGroup?: AttributeResource }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [filters, setFilters] = useState(emptyProductFilters);
  const [tab, setTab] = useState(initialTab);
  const [catalog, setCatalog] = useState<AttributeCatalog>({ categories: [], collections: [], colors: [], sizes: [] });
  const [attributesLoading, setAttributesLoading] = useState(true);
  const [attributeErrors, setAttributeErrors] = useState<Partial<Record<AttributeResource, string>>>({});
  const [attributePending, setAttributePending] = useState<Record<AttributeResource, boolean>>({ categories: true, collections: true, colors: true, sizes: true });
  const attributesError = Object.values(attributeErrors).join(" ");
  const [attributesReload, setAttributesReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    catalogRequest("/api/admin/products", productListSchema, { signal: controller.signal })
      .then(products => { if (!controller.signal.aborted) setProducts(products); }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(attributeResources.map(async resource => {
      try {
        const items = await catalogRequest(`/api/admin/${resource}`, attributeListSchema, { signal: controller.signal });
        if (!controller.signal.aborted) setCatalog(current => ({ ...current, [resource]: items }));
      } catch (error) {
        if (!controller.signal.aborted) setAttributeErrors(current => ({ ...current, [resource]: error instanceof Error ? error.message : "Could not load attributes." }));
      } finally {
        if (!controller.signal.aborted) setAttributePending(current => ({ ...current, [resource]: false }));
      }
    }))
      .finally(() => { if (!controller.signal.aborted) setAttributesLoading(false); });
    return () => controller.abort();
  }, [attributesReload]);
  const visible = filterProducts(products, search, status, filters);
  const hasFilters = !!search || status !== "ALL" || Object.values(filters).some(Boolean);
  const retryAttributes = () => { setAttributeErrors({}); setAttributePending({ categories: true, collections: true, colors: true, sizes: true }); setAttributesLoading(true); setAttributesReload(n => n + 1); };
  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Products</p><h1 className="mt-2 text-2xl font-medium">All Products</h1><p className="mt-2 text-sm text-neutral-500">Manage your catalog, drafts and stock availability.</p></div>
      <Link href="/admin/products/create" className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">Create Product</Link>
    </div>
    <div role="tablist" aria-label="Product management" className="flex gap-2 border-b border-neutral-200">
      {(["products", "attributes"] as const).map(value => <button key={value} type="button" role="tab" id={`tab-${value}`} aria-selected={tab === value} aria-controls={`panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? "products" : event.key === "End" ? "attributes" : value === "products" ? "attributes" : "products";
          setTab(next); document.getElementById(`tab-${next}`)?.focus();
        }
      }} className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === value ? "border-neutral-950 text-neutral-950" : "border-transparent text-neutral-500 hover:text-neutral-950"}`}>{value === "products" ? "Products" : "Manage Attributes"}</button>)}
    </div>
    <div role="tabpanel" id="panel-attributes" aria-labelledby="tab-attributes" hidden={tab !== "attributes"}>
      <ManageAttributes catalog={catalog} initialGroup={initialGroup} loading={attributePending} errors={attributeErrors} onReload={retryAttributes} onDeleted={(resource, id) => {
        setCatalog(current => ({ ...current, [resource]: current[resource].filter(item => item.id !== id) }));
        const key = ({ categories: "categoryId", collections: "collectionId", colors: "colorId", sizes: "sizeId" } as const)[resource];
        setFilters(current => current[key] === id ? { ...current, [key]: "" } : current);
      }} onSaved={(resource, item) => setCatalog(current => ({ ...current, [resource]: [...current[resource].filter(existing => existing.id !== item.id), item].sort((a, b) => resource === "sizes" ? (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)) }))} />
    </div>
    <div role="tabpanel" id="panel-products" aria-labelledby="tab-products" hidden={tab !== "products"} className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div className="flex-1 text-sm"><label htmlFor="product-search">Search products</label><input id="product-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or slug" className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white p-3" /></div>
      <div className="text-sm"><label htmlFor="product-status">Status</label><select id="product-status" value={status} onChange={e => setStatus(e.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white p-3"><option value="ALL">All statuses</option>{["DRAFT", "ACTIVE", "ARCHIVED"].map(s => <option key={s}>{s}</option>)}</select></div>
      {attributeResources.map(resource => {
        const key = ({ categories: "categoryId", collections: "collectionId", colors: "colorId", sizes: "sizeId" } as const)[resource];
        const label = ({ categories: "Category", collections: "Collection", colors: "Color", sizes: "Size" } as const)[resource];
        return <div key={resource} className="min-w-0 text-sm"><label htmlFor={`filter-${resource}`}>{label}</label><select id={`filter-${resource}`} disabled={attributePending[resource] || !!attributeErrors[resource]} value={filters[key]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 bg-white p-3 disabled:opacity-50"><option value="">All {attributeLabels[resource].toLowerCase()}</option>{catalog[resource].map(option => <option key={option.id} value={option.id}>{option.name}{option.isActive === false ? " (inactive)" : ""}</option>)}</select></div>;
      })}
    </div>
    {attributesLoading && <p role="status" className="text-sm text-neutral-500">Loading filter options…</p>}
    {attributesError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800"><p>Filter options: {attributesError}</p><button type="button" onClick={retryAttributes} className="mt-2 underline">Reload filter options</button></div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      {!loading && !error && <p role="status" className="text-sm text-neutral-500">{visible.length} of {products.length} products</p>}
      <button type="button" disabled={!hasFilters} onClick={() => { setSearch(""); setStatus("ALL"); setFilters(emptyProductFilters); }} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50">Clear Filters</button>
    </div>
    {loading ? <p role="status" className="rounded-xl border border-neutral-200 bg-white p-8 text-sm text-neutral-500">Loading products…</p> : error ?
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"><p>{error}</p><button type="button" className="mt-3 underline" onClick={() => { setError(""); setLoading(true); setReload(n => n + 1); }}>Try again</button></div> : !visible.length ?
      <div role="status" className="rounded-xl border border-neutral-200 bg-white p-8 text-center"><p className="font-medium">{products.length ? "No matching products" : "No products yet"}</p><p className="mt-2 text-sm text-neutral-500">{products.length ? "Try a different search or status." : "Create your first product as a draft."}</p></div> : <>
        <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-white md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Product catalog</caption><thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500"><tr>{["Product", "Price", "Status", "Variants", "Available stock"].map(title => <th key={title} scope="col" className="px-5 py-4 font-medium">{title}</th>)}</tr></thead><tbody>{visible.map(product => <tr key={product.id} className="border-b border-neutral-100 last:border-0"><td className="px-5 py-4"><div className="flex items-center gap-3"><Thumbnail product={product} /><div className="min-w-0"><Link href={`/admin/products/${encodeURIComponent(product.id)}/edit`} className="break-words font-medium hover:underline">{product.name}</Link><p className="mt-1 break-all text-xs text-neutral-500">{product.slug}</p></div></div></td><td className="whitespace-nowrap px-5 py-4">{formatPrice(product.basePrice)}</td><td className="px-5 py-4"><Status status={product.status} /></td><td className="px-5 py-4">{product.variants.length}</td><td className="px-5 py-4 text-neutral-500">{inventorySummary(product)}</td></tr>)}</tbody></table></div>
        <div className="space-y-3 md:hidden">{visible.map(product => <article key={product.id} className="rounded-xl border border-neutral-200 bg-white p-4"><div className="flex gap-3"><Thumbnail product={product} /><div className="min-w-0 flex-1"><h2 className="break-words font-medium"><Link href={`/admin/products/${encodeURIComponent(product.id)}/edit`} className="hover:underline">{product.name}</Link></h2><p className="mt-1 break-all text-xs text-neutral-500">{product.slug}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{formatPrice(product.basePrice)}</span><Status status={product.status} /></div><p className="mt-3 text-xs text-neutral-500">{product.variants.length} variant(s) · {inventorySummary(product)}</p></article>)}</div>
      </>}
    </div>
  </section>;
}
