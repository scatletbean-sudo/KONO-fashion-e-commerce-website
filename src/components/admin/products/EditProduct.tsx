"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { catalogRequest } from "@/features/products/admin/product-management";
import { editableProductSchema, type EditableProduct } from "@/features/products/admin/product-edit";
import ProductForm from "./ProductForm";
import MediaManager from "./MediaManager";

export default function EditProduct({ id }: { id: string }) {
  const [product, setProduct] = useState<EditableProduct | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    catalogRequest(`/api/admin/products/${encodeURIComponent(id)}`, editableProductSchema, { signal: controller.signal })
      .then(product => { if (!controller.signal.aborted) setProduct(product); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id, reload]);
  if (error) return <section className="space-y-4"><h1 className="text-2xl font-medium">Edit Product</h1><div role="alert" className="rounded-lg bg-red-50 p-5 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => { setError(""); setReload(value => value + 1); }} className="mt-2 underline">Try again</button></div><Link href="/admin/products" className="text-sm underline">Back to All Products</Link></section>;
  if (!product) return <p role="status" className="text-sm text-neutral-500">Loading product…</p>;
  return <div className="space-y-6"><ProductForm key={product.id} initialProduct={product} />
    <MediaManager productId={product.id} productName={product.name} initialImages={product.images.map(image => ({ ...image, productId: product.id, imageType: image.imageType ?? "PRODUCT" }))} />
    <section aria-labelledby="product-danger-zone" className="rounded-xl border border-red-200 bg-white p-5">
      <h2 id="product-danger-zone" className="font-medium text-red-800">Danger Zone</h2>
      <p className="mt-2 break-words text-sm text-neutral-600">Permanent deletion of {product.name} is disabled. Related inventory, reviews and cart data must be protected first.</p>
      <p className="mt-2 text-sm text-neutral-600">To stop selling this product while preserving its data, select ARCHIVED in the form and Save Changes.</p>
      <button type="button" disabled className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 opacity-50">Delete Product</button>
    </section>
  </div>;
}
