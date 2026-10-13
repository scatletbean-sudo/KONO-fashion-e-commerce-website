import EditorialImage from "./EditorialImage";
import Link from "next/link";
import { productPrice, type StorefrontProduct } from "./catalog";
import styles from "./storefront.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function ProductCard({ product }: { product: StorefrontProduct }) {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const inStock = product.variants.some((variant) => variant.inStock);
  const price = productPrice(product);
  const variedPrices = new Set(product.variants.map((variant) => variant.priceOverride ?? product.basePrice)).size > 1;
  const colors = [...new Set(product.variants.flatMap((variant) => variant.color ? [variant.color.name] : []))];
  return <article className={styles.productCard}><Link href={`/products/${encodeURIComponent(product.slug)}`} aria-label={`Xem ${product.name}`}>
    <div className={styles.productImage}>{image ? <EditorialImage src={image.url} alt={image.alt || product.name} fit={["MULTI_VIEW", "SIZE_CHART"].includes(image.imageType ?? "PRODUCT") ? "contain" : "cover"} sizes="(max-width: 560px) 45vw, (max-width: 1024px) 44vw, 23vw" /> : <div className={styles.imageFallback} role="img" aria-label={`${product.name} — chưa có ảnh`}><span>KONO®</span><small>ẢNH ĐANG CẬP NHẬT</small></div>}<span className={styles.stockBadge}>{inStock ? "CÒN HÀNG" : "TẠM HẾT HÀNG"}</span></div>
    <div className={styles.productInfo}><h3>{product.name}</h3><p>{variedPrices ? "Từ " : ""}{money.format(price)}{product.compareAtPrice != null && product.compareAtPrice > price && <del>{money.format(product.compareAtPrice)}</del>}</p>{colors.length > 0 && <p>{colors.join(" / ")}</p>}</div></Link>
  </article>;
}
