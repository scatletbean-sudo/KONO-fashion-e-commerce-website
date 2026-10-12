import type { Metadata } from "next";
import { Suspense } from "react";
import Shop from "@/components/storefront/Shop";
import { StorefrontHeader, StorefrontFooter } from "@/components/storefront/StorefrontShell";
import styles from "@/components/storefront/storefront.module.css";

export const metadata: Metadata = { title: "The Collection — KONO®", description: "Khám phá bộ sưu tập KONO. Tìm denim và streetwear theo danh mục, màu sắc, kích cỡ và giá." };
export default function ShopPage() {
  return <div className={styles.storefront} lang="vi"><a className={styles.skipLink} href="#main-content">Bỏ qua điều hướng</a><StorefrontHeader /><Suspense fallback={<main id="main-content" className={styles.catalogMessage} role="status">Đang tải Shop…</main>}><Shop /></Suspense><StorefrontFooter /></div>;
}
