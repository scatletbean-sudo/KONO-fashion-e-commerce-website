import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/storefront/ProductDetail";
import { getServerCatalog } from "@/components/storefront/server-catalog";
import { StorefrontHeader, StorefrontFooter } from "@/components/storefront/StorefrontShell";
import styles from "@/components/storefront/storefront.module.css";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = (await getServerCatalog()).find((item) => item.slug === slug);
    if (!product) return { title: "Không tìm thấy sản phẩm — KONO®", robots: { index: false } };
    const title = product.metaTitle || `${product.name} — KONO®`;
    const description = product.metaDescription || product.shortDescription || product.description?.slice(0, 160) || `Khám phá ${product.name} tại KONO.`;
    return { title, description, alternates: { canonical: `/products/${encodeURIComponent(product.slug)}` }, openGraph: { title, description, type: "website", locale: "vi_VN" } };
  } catch { return { title: "Sản phẩm — KONO®", robots: { index: false } }; }
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  let products;
  try { products = await getServerCatalog(); } catch { /* Client can retry the public API. */ }
  if (products && !products.some((product) => product.slug === slug)) notFound();
  return <div className={styles.storefront} lang="vi"><a className={styles.skipLink} href="#main-content">Bỏ qua điều hướng</a><StorefrontHeader /><ProductDetail slug={slug} initial={products} /><StorefrontFooter /></div>;
}
