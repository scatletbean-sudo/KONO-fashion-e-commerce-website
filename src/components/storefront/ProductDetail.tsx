"use client";
import Link from "next/link";
import { useState } from "react";
import { matchingVariants, type StorefrontProduct } from "./catalog";
import { useCatalog } from "./useCatalog";
import EditorialImage from "./EditorialImage";
import ProductCard from "./ProductCard";
import base from "./storefront.module.css";
import styles from "./shop.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function DetailContent({ product, related }: { product: StorefrontProduct; related: StorefrontProduct[] }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [color, setColor] = useState(product.variants[0]?.color?.id ?? "");
  const [size, setSize] = useState(product.variants[0]?.size?.id ?? "");
  const variants = matchingVariants(product, color, size);
  const selected = variants.length === 1 ? variants[0] : null;
  const price = selected ? selected.priceOverride ?? product.basePrice : product.variants.length === 0 ? product.basePrice : null;
  const colors = [...new Map(product.variants.map((variant) => [variant.color?.id ?? "", { id: variant.color?.id ?? "", name: variant.color?.name ?? "Tiêu chuẩn" }])).values()];
  const sizes = [...new Map(product.variants.map((variant) => [variant.size?.id ?? "", { id: variant.size?.id ?? "", name: variant.size?.name ?? "One size", order: variant.size?.sortOrder ?? 0 }])).values()].sort((a, b) => a.order - b.order);
  const images = [...product.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
  return <>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">KONO</Link><span>/</span><Link href="/shop">Shop</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
    <div className={styles.detail}>
      <div className={styles.gallery}><div className={styles.mainImage}>{images[imageIndex] ? <EditorialImage src={images[imageIndex].url} alt={images[imageIndex].alt || product.name} sizes="(max-width: 760px) 88vw, 54vw" eager /> : <div className={base.imageFallback} role="img" aria-label="Ảnh sản phẩm đang cập nhật"><span>KONO®</span><small>ẢNH ĐANG CẬP NHẬT</small></div>}</div>{images.length > 1 && <div className={styles.thumbnails} aria-label="Ảnh sản phẩm">{images.map((image, index) => <button key={image.id} onClick={() => setImageIndex(index)} aria-label={`Xem ảnh ${index + 1}`} aria-pressed={imageIndex === index}><EditorialImage src={image.url} alt="" sizes="90px" /></button>)}</div>}</div>
      <div className={styles.info}><p className={base.eyebrow}>KONO / FORM & IDENTITY</p><h1>{product.name}</h1><p className={styles.price} aria-live="polite">{price !== null ? money.format(price) : "Chọn phiên bản sản phẩm"}{price !== null && product.compareAtPrice != null && product.compareAtPrice > price && <del>{money.format(product.compareAtPrice)}</del>}</p>{product.shortDescription && <p className={styles.description}>{product.shortDescription}</p>}
        {product.variants.length > 0 && <><fieldset><legend>Màu: {colors.find((option) => option.id === color)?.name}</legend><div className={styles.options}>{colors.map((option) => <button key={option.id} aria-pressed={color === option.id} onClick={() => { setColor(option.id); if (!matchingVariants(product, option.id, size).length) setSize(product.variants.find((variant) => (variant.color?.id ?? "") === option.id)?.size?.id ?? ""); }}>{option.name}</button>)}</div></fieldset><fieldset><legend>Size</legend><div className={styles.options}>{sizes.map((option) => <button key={option.id} disabled={!matchingVariants(product, color, option.id).length} aria-pressed={size === option.id} onClick={() => setSize(option.id)}>{option.name}</button>)}</div></fieldset></>}
        <p className={styles.stock} role="status">{!product.variants.length ? "Sản phẩm chưa có phiên bản khả dụng." : variants.length > 1 ? "Có nhiều SKU cho lựa chọn này. Chưa thể xác định phiên bản." : selected?.inStock ? "Còn hàng" : "Phiên bản này hiện hết hàng."}</p>
        <div className={styles.notice}>Giỏ hàng đang được phát triển. Chưa thể đặt mua trên website.</div>
        <details className={styles.descriptionPanel} open><summary>MÔ TẢ SẢN PHẨM</summary><p>{product.description || "Thông tin sản phẩm đang được cập nhật."}</p></details>
      </div>
    </div>
    {related.length > 0 && <section className={styles.related} aria-labelledby="related-title"><div className={base.sectionHeading}><h2 id="related-title">THE SAME ENERGY.</h2><Link href="/shop" className={base.textLink}>XEM SHOP</Link></div><div className={base.productGrid}>{related.slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
  </>;
}

export default function ProductDetail({ slug, initial }: { slug: string; initial?: StorefrontProduct[] }) {
  const { products, status, retry } = useCatalog(initial);
  const product = products.find((item) => item.slug === slug);
  const related = product ? products.filter((item) => item.id !== product.id && (item.categories.some((link) => product.categories.some((other) => link.category.id === other.category.id)) || item.collections.some((link) => product.collections.some((other) => link.collection.id === other.collection.id)))) : [];
  return <main id="main-content" className={styles.productPage} aria-busy={status === "loading"}>{status === "loading" ? <div className={base.catalogMessage} role="status">Đang tải sản phẩm…</div> : status === "error" ? <div className={base.catalogMessage} role="alert"><p>Chưa thể tải sản phẩm.</p><button className={base.cta} onClick={retry}>THỬ LẠI</button></div> : product ? <DetailContent key={product.id} product={product} related={related} /> : <div className={base.catalogMessage}><h1>Không tìm thấy sản phẩm.</h1><Link href="/shop" className={base.cta}>TRỞ VỀ SHOP</Link></div>}</main>;
}
