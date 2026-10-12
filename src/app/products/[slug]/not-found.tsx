import Link from "next/link";
import { StorefrontHeader, StorefrontFooter } from "@/components/storefront/StorefrontShell";
import styles from "@/components/storefront/storefront.module.css";
export default function ProductNotFound() {
  return <div className={styles.storefront} lang="vi"><StorefrontHeader /><main className={styles.catalogMessage}><h1>Không tìm thấy sản phẩm.</h1><p>Sản phẩm có thể chưa được công khai hoặc đã ngừng bán.</p><Link href="/shop" className={styles.cta}>TRỞ VỀ SHOP</Link></main><StorefrontFooter /></div>;
}
