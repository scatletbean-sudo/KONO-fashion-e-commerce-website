"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { matchingVariants, type StorefrontProduct } from "./catalog";
import { variantPrice } from "./product-detail";
import { useCatalog } from "./useCatalog";
import ProductGallery, { SizeGuide } from "./ProductGallery";
import ProductCard from "./ProductCard";
import PurchasePanel from "./PurchasePanel";
import base from "./storefront.module.css";
import shop from "./shop.module.css";
import styles from "./product-detail.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function DetailContent({ product, related }: { product: StorefrontProduct; related: StorefrontProduct[] }) {
  const panel = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    // Long descriptions, expanded accordions and short viewports remain in normal flow.
    const measure = () => setSticky(node.getBoundingClientRect().height + 48 <= window.innerHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(node); window.addEventListener("resize", measure); measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const [color, setColor] = useState(product.variants[0]?.color?.id ?? "");
  const [size, setSize] = useState<string | null>(product.variants.some(variant => variant.size) ? null : "");
  const variants = size === null ? [] : matchingVariants(product, color, size);
  const selected = variants.length === 1 ? variants[0] : null;
  const price = variantPrice(product, selected);
  const prices = product.variants.map(variant => variantPrice(product, variant)).filter((value): value is number => value !== null);
  const colors = [...new Map(product.variants.map(variant => [variant.color?.id ?? "", { id: variant.color?.id ?? "", name: variant.color?.name ?? "Tiêu chuẩn", hex: variant.color?.hexCode }])).values()];
  const sizes = [...new Map(product.variants.map(variant => [variant.size?.id ?? "", { id: variant.size?.id ?? "", name: variant.size?.name ?? "One size", order: variant.size?.sortOrder ?? 0 }])).values()].sort((a, b) => a.order - b.order);
  const categories = product.categories.map(link => link.category.name);
  const collections = product.collections.map(link => link.collection.name);
  return <>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">KONO</Link><span>/</span><Link href="/shop">Shop</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
    <div className={styles.detail}>
      <ProductGallery images={product.images} name={product.name} />
      <div ref={panel} data-sticky={sticky} className={styles.info}><p className={styles.eyebrow}>KONO / {collections.length ? collections.join(" · ") : categories.length ? categories.join(" · ") : "FORM & IDENTITY"}</p><h1>{product.name}</h1>
        <p className={styles.price} aria-live="polite">{price !== null ? money.format(price) : prices.length ? `${new Set(prices).size > 1 ? "Từ " : ""}${money.format(Math.min(...prices))}` : "Giá chưa khả dụng"}{price !== null && product.compareAtPrice != null && product.compareAtPrice > price && <del>{money.format(product.compareAtPrice)}</del>}</p>
        {product.shortDescription && <p className={styles.description}>{product.shortDescription}</p>}
        {product.variants.length > 0 && <>
          <fieldset className={styles.fieldset}><legend>Màu / <span>{colors.find(option => option.id === color)?.name}</span></legend><div className={styles.options}>{colors.map(option => <button type="button" key={option.id} aria-pressed={color === option.id} onClick={() => { setColor(option.id); setSize(product.variants.some(variant => (variant.color?.id ?? "") === option.id && variant.size) ? null : ""); }}>{option.hex && /^#[a-fA-F0-9]{6}$/.test(option.hex) && <span aria-hidden="true" className={styles.swatch} style={{ backgroundColor: option.hex }} />}{option.name}</button>)}</div></fieldset>
          <div className={styles.sizeHeading}><span>CHỌN SIZE</span><SizeGuide images={product.images} name={product.name} /></div>
          <fieldset className={styles.fieldset}><legend className={styles.srOnly}>Size</legend><div className={styles.options}>{sizes.map(option => { const matches = matchingVariants(product, color, option.id); const out = matches.length > 0 && !matches.some(variant => variant.inStock); return <button type="button" key={option.id} disabled={!matches.length} aria-pressed={size === option.id} aria-label={`Size ${option.name}${out ? " — hết hàng" : ""}`} data-sold-out={out} onClick={() => setSize(option.id)}>{option.name}{out && <span className={styles.srOnly}> — hết hàng</span>}</button>; })}</div></fieldset>
        </>}
        {!product.variants.length && <SizeGuide images={product.images} name={product.name} />}
        {!selected && <p className={styles.stock} role="status">{!product.variants.length ? "Sản phẩm chưa có phiên bản khả dụng." : size === null ? "Chọn size để kiểm tra phiên bản." : variants.length > 1 ? "Chưa thể xác định phiên bản cho lựa chọn này." : "Phiên bản này hiện hết hàng."}</p>}
        <PurchasePanel key={selected?.id ?? "unselected"} variant={selected} />
        <div className={styles.accordions}>
          <details open><summary>PRODUCT DETAILS<span aria-hidden="true">+</span></summary><p>{product.description || "Thông tin sản phẩm đang được cập nhật."}</p>{categories.length > 0 && <p>Category / {categories.join(" · ")}</p>}</details>
          <details><summary>SIZE & FIT<span aria-hidden="true">+</span></summary><p>{product.images.some(image => image.imageType === "SIZE_CHART") ? "Xem Size Guide để đối chiếu bảng size của sản phẩm." : "Thông tin kích thước và phom dáng đang được cập nhật."}</p>{product.images.some(image => image.imageType === "SIZE_CHART") && <SizeGuide images={product.images} name={product.name} />}</details>
          <details><summary>SHIPPING & RETURNS<span aria-hidden="true">+</span></summary><p>Thông tin vận chuyển và đổi trả đang được cập nhật.</p></details>
        </div>
      </div>
    </div>
    {related.length > 0 && <section className={shop.related} aria-labelledby="related-title"><div className={base.sectionHeading}><h2 id="related-title">THE SAME ENERGY.</h2><Link href="/shop" className={base.textLink}>XEM SHOP</Link></div><div className={base.productGrid}>{related.slice(0, 4).map(item => <ProductCard key={item.id} product={item} />)}</div></section>}
  </>;
}

export default function ProductDetail({ slug, initial }: { slug: string; initial?: StorefrontProduct[] }) {
  const { products, status, retry } = useCatalog(initial);
  const product = products.find(item => item.slug === slug);
  const related = product ? products.filter(item => item.id !== product.id && (item.categories.some(link => product.categories.some(other => link.category.id === other.category.id)) || item.collections.some(link => product.collections.some(other => link.collection.id === other.collection.id)))) : [];
  return <main id="main-content" className={styles.page} aria-busy={status === "loading"}>{status === "loading" ? <div className={styles.loadingPage} role="status" aria-label="Đang tải sản phẩm"><div className={styles.skeleton} /><p>Đang tải sản phẩm…</p></div> : status === "error" ? <div className={base.catalogMessage} role="alert"><p>Chưa thể tải sản phẩm.</p><button type="button" className={base.cta} onClick={retry}>THỬ LẠI</button></div> : product ? <DetailContent key={product.id} product={product} related={related} /> : <div className={base.catalogMessage}><h1>Không tìm thấy sản phẩm.</h1><Link href="/shop" className={base.cta}>TRỞ VỀ SHOP</Link></div>}</main>;
}
