"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { catalogSchema, type StorefrontProduct } from "./catalog";
import ProductCard from "./ProductCard";
import CollectionPreview from "./CollectionPreview";
import styles from "./storefront.module.css";

type CatalogState = { status: "loading" } | { status: "error" } | { status: "ready"; products: StorefrontProduct[] };

export default function NewArrivals() {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setState({ status: "error" });
    }, 12000);
    async function load() {
      try {
        const response = await fetch("/api/products", { signal: controller.signal, cache: "no-store", credentials: "omit" });
        if (!response.ok) throw new Error("Catalog request failed");
        const parsed = catalogSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Catalog response is invalid");
        if (!controller.signal.aborted) setState({ status: "ready", products: parsed.data.data });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  const filtered = state.status === "ready" ? state.products.filter((product) => product.name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))) : [];
  const retry = () => { setState({ status: "loading" }); setAttempt((value) => value + 1); };
  return <section id="new-arrivals" className={styles.arrivals} aria-labelledby="arrivals-title" aria-busy={state.status === "loading"}>
    <noscript>Bật JavaScript để xem sản phẩm mới từ KONO.</noscript>
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE LATEST IN OUR WORLD</p><h2 id="arrivals-title">NEW ARRIVALS<span className={styles.sectionNumber}> / 01</span></h2></div><a className={styles.textLink} href="#collections">COLLECTION NOTES <ArrowUpRight size={16} aria-hidden="true" /></a></div>
    <div className={styles.catalogTools}><p>Khám phá nhịp điệu mới của KONO.</p><label className={styles.searchField} htmlFor="catalog-search"><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>Tìm sản phẩm theo tên</span><input id="catalog-search" type="search" placeholder="Tìm sản phẩm" value={query} onChange={(event) => setQuery(event.target.value)} disabled={state.status !== "ready"} /></label></div>
    {state.status === "loading" && <><p className={styles.srOnly} role="status">Đang tải sản phẩm…</p><div className={styles.productGrid} aria-hidden="true">{[0, 1, 2, 3].map((index) => <div key={index} className={styles.skeleton}><div /><span /><span /></div>)}</div></>}
    {state.status === "error" && <div className={styles.catalogMessage} role="alert"><p>Chưa thể tải sản phẩm.</p><span>Vui lòng thử lại sau. Nội dung editorial vẫn có thể xem bên dưới.</span><button className={styles.cta} onClick={retry}>THỬ LẠI <ArrowUpRight size={16} aria-hidden="true" /></button></div>}
    {state.status === "ready" && state.products.length === 0 && <CollectionPreview />}
    {state.status === "ready" && state.products.length > 0 && <><p className={styles.srOnly} role="status">{filtered.length} sản phẩm phù hợp. Hiển thị tối đa 4 sản phẩm.</p>{filtered.length ? <div className={styles.productGrid}>{filtered.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className={styles.catalogMessage}><p>Không tìm thấy sản phẩm phù hợp.</p><button className={styles.textLink} onClick={() => setQuery("")}>XÓA TÌM KIẾM</button></div>}</>}
  </section>;
}
