import Link from "next/link";

export default function AdminProductReviewsPage() {
  return <section className="space-y-4">
    <h1 className="text-2xl font-medium">Product Reviews</h1>
    <p className="text-sm text-neutral-500">Product review management is not available yet.</p>
    <Link href="/admin/products" className="inline-block rounded-lg bg-neutral-950 px-4 py-2.5 text-sm text-white">Back to All Products</Link>
  </section>;
}
