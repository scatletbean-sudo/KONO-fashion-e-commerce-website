"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { filterProducts, readFilters, type ShopFilters } from "./catalog";
import { useCatalog } from "./useCatalog";
import ProductCard from "./ProductCard";
import base from "./storefront.module.css";
import styles from "./shop.module.css";

export default function Shop() {
  const { products, status, retry } = useCatalog();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const filters = readFilters(new URLSearchParams(params.toString()));
  function update(key: keyof ShopFilters, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  const categories = [...new Map(products.flatMap((product) => product.categories.map(({ category }) => [category.slug, category] as const))).values()];
  const collections = [...new Map(products.flatMap((product) => product.collections.map(({ collection }) => [collection.slug, collection] as const))).values()];
  const colors = [...new Map(products.flatMap((product) => product.variants.flatMap((variant) => variant.color ? [[variant.color.id, variant.color] as const] : []))).values()];
  const sizes = [...new Map(products.flatMap((product) => product.variants.flatMap((variant) => variant.size ? [[variant.size.id, variant.size] as const] : []))).values()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const visible = filterProducts(products, filters);
  return <main id="main-content" className={styles.shop}>
    <div className={styles.title}><p className={base.eyebrow}>KONO / THE EVERYDAY EDIT</p><h1>THE COLLECTION.</h1><p>Phom dáng tự do. Bản sắc của riêng bạn.</p></div>
    <form className={styles.filters} onSubmit={(event) => event.preventDefault()} aria-label="Tìm kiếm và bộ lọc">
      <label className={styles.search}>Tìm sản phẩm<input id="catalog-search" type="search" value={filters.q} onChange={(event) => update("q", event.target.value)} placeholder="Tìm theo tên" /></label>
      {([{ key: "category", label: "Danh mục", options: categories.map((option) => ({ id: option.slug ?? "", name: option.name })) }, { key: "collection", label: "Bộ sưu tập", options: collections.map((option) => ({ id: option.slug ?? "", name: option.name })) }, { key: "color", label: "Màu", options: colors }, { key: "size", label: "Size", options: sizes }] as const).filter((group) => group.options.length).map((group) => <label key={group.key}>{group.label}<select value={filters[group.key]} onChange={(event) => update(group.key, event.target.value)}><option value="">Tất cả</option>{filters[group.key] && !group.options.some((option) => option.id === filters[group.key]) && <option value={filters[group.key]}>Không có lựa chọn này</option>}{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>)}
      {products.length > 0 && <><label>Giá từ (VND)<input type="number" min="0" step="1000" value={filters.min} onChange={(event) => update("min", event.target.value)} /></label><label>Giá đến (VND)<input type="number" min="0" step="1000" value={filters.max} onChange={(event) => update("max", event.target.value)} /></label></>}
      <label>Sắp xếp<select value={filters.sort} onChange={(event) => update("sort", event.target.value)}><option value="newest">Mới nhất</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option><option value="name">Tên A–Z</option></select></label>
      <Link className={styles.reset} href="/shop" scroll={false}>Xóa bộ lọc</Link>
    </form>
    {filters.min && filters.max && Number(filters.min) > Number(filters.max) && <p role="status" className={styles.notice}>Giá từ cần nhỏ hơn hoặc bằng giá đến.</p>}
    <div aria-busy={status === "loading"}>
      {status === "loading" && <><p role="status">Đang tải bộ sưu tập…</p><div className={`${base.productGrid} ${styles.grid}`} aria-hidden="true">{[0, 1, 2, 3].map((id) => <div className={base.skeleton} key={id}><div /><span /><span /></div>)}</div></>}
      {status === "error" && <div className={base.catalogMessage} role="alert"><p>Chưa thể tải bộ sưu tập.</p><button className={base.cta} onClick={retry}>THỬ LẠI</button></div>}
      {status === "ready" && <><p className={styles.count} role="status">{visible.length} sản phẩm</p>{visible.length ? <div className={`${base.productGrid} ${styles.grid}`}>{visible.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className={base.catalogMessage}><p>{products.length ? "Không có sản phẩm phù hợp bộ lọc." : "Bộ sưu tập đang được chuẩn bị."}</p><Link className={base.textLink} href={products.length ? "/shop" : "/#collections"}>{products.length ? "XÓA BỘ LỌC" : "KHÁM PHÁ KONO"}</Link></div>}</>}
    </div>
  </main>;
}
