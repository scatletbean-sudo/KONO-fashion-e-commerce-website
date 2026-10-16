import Link from "next/link";
import { ArrowUpRight, Search, UserRound } from "lucide-react";
import styles from "./storefront.module.css";
import CartBag from "./CartBag";

const navigation = [{ label: "SHOP", href: "/shop" }, { label: "COLLECTIONS", href: "/#collections" }, { label: "ABOUT", href: "/#about" }];

export function StorefrontHeader() {
  return <header className={styles.header}>
    <Link className={styles.logo} href="/" aria-label="KONO — đầu trang">KONO<span>®</span></Link>
    <nav className={styles.desktopNav} aria-label="Điều hướng chính">{navigation.map((item) => <Link key={item.label} href={item.href}>{item.label}</Link>)}</nav>
    <div className={styles.headerTools}><Link href="/shop#catalog-search" aria-label="Tìm sản phẩm"><Search size={19} strokeWidth={1.5} /></Link><button disabled title="Tài khoản khách hàng chưa khả dụng" aria-label="Tài khoản khách hàng chưa khả dụng"><UserRound size={19} strokeWidth={1.5} /></button><CartBag /></div>
    <details className={styles.mobileNav}><summary>MENU <span aria-hidden="true">+</span></summary><nav aria-label="Điều hướng mobile">{navigation.map((item) => <Link key={item.label} href={item.href}>{item.label}</Link>)}</nav></details>
  </header>;
}

export function StorefrontFooter() {
  return <footer className={styles.footer}>
    <div className={styles.footerTop}><div><p className={styles.eyebrow}>INDEPENDENT BY DESIGN.</p><p className={styles.footerStatement}>A DIFFERENT<br />POINT OF VIEW.</p></div><nav aria-label="Điều hướng chân trang">{navigation.map((item) => <Link key={item.label} href={item.href}>{item.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>)}<Link href="/#lookbook">VISUAL JOURNAL <ArrowUpRight size={14} aria-hidden="true" /></Link></nav><div className={styles.footerAbout}><p>DENIM / FORM / IDENTITY</p><p>Thời trang độc lập.<br />Mặc theo cách của bạn.</p><span>Chức năng mua hàng đang được phát triển.</span></div></div>
    <Link className={styles.footerLogo} href="/" aria-label="KONO — trở về đầu trang">KONO<span>®</span></Link>
    <div className={styles.footerBottom}><span>© {new Date().getUTCFullYear()} KONO</span><details id="image-sources" className={styles.sources}><summary>IMAGE CREDITS</summary><p>Moodboard photography / Unsplash License</p><a href="https://unsplash.com/photos/I-8k_ba046w" target="_blank" rel="noopener noreferrer">Hannah Busing — Denim rooftop</a><a href="https://unsplash.com/photos/JQmHidojfvs" target="_blank" rel="noopener noreferrer">Marc Clinton Labiano — Street uniform</a><a href="https://unsplash.com/photos/PF4fdD3018I" target="_blank" rel="noopener noreferrer">DJ Tears PLK — Cargo silhouette</a><a href="https://unsplash.com/photos/w8Dxyxovyu4" target="_blank" rel="noopener noreferrer">the blowup — Concrete study</a><a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">License</a></details><span>RECODE THE ORDINARY.</span></div>
  </footer>;
}
