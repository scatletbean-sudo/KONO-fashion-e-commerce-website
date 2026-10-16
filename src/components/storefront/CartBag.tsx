"use client";
import { useEffect, useRef, useState } from "react";
import { ImageOff, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/features/cart/cart-store";
import styles from "./product-detail.module.css";
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
function Thumbnail({ url, name }: { url?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const safe = url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url));
  return <div className={styles.bagThumbnail}>{safe && !broken ?
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} onError={() => setBroken(true)} referrerPolicy="no-referrer" /> : <span role="img" aria-label={`${name} — ảnh chưa khả dụng`}><ImageOff size={24} strokeWidth={1} /></span>}</div>;
}
function BagDialog({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { items, busy, error, notice, sync, setQuantity } = useCartStore();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    ref.current?.showModal(); void useCartStore.getState().sync();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; trigger?.focus(); };
  }, []);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return <dialog ref={ref} onCancel={close} className={styles.bagDialog} aria-labelledby="bag-title">
    <header className={styles.bagTitle}><div><span className={styles.eyebrow}>KONO / YOUR SELECTION</span><h2 id="bag-title">YOUR BAG <span>({count})</span></h2></div><button type="button" aria-label="Close shopping bag" onClick={close}><X size={20} /></button></header>
    <div className={styles.bagContent} aria-busy={busy}>
      <div className={styles.bagStatus} role="status">{busy ? "Đang cập nhật…" : notice}</div>
      {error && <div role="alert" className={styles.bagError}><p>{error}</p><button type="button" disabled={busy} onClick={() => void sync()}>Thử lại</button></div>}
      {!items.length && !busy && !error && <div className={styles.bagEmpty}><ShoppingBag size={44} strokeWidth={1} /><h3>MAKE IT YOURS.</h3><p>Giỏ hàng của bạn đang trống.</p><Link href="/shop" onClick={close} className={styles.addButton}>CONTINUE SHOPPING</Link></div>}
      <ul>{items.map(item => <li key={item.variantId} className={styles.bagItem}>
        <Link href={`/products/${encodeURIComponent(item.slug)}`} onClick={close} tabIndex={-1} aria-hidden="true"><Thumbnail key={item.imageUrl} url={item.imageUrl} name={item.name} /></Link>
        <div className={styles.bagItemInfo}><Link href={`/products/${encodeURIComponent(item.slug)}`} onClick={close}>{item.name}</Link><p>{[item.color, item.size].filter(Boolean).join(" / ")}</p><p>Đơn giá / {money.format(item.price)}</p><strong className={styles.bagLineTotal}>{money.format(item.price * item.quantity)}</strong>
          {item.quantity > item.maxQuantity && <p role="status">{item.maxQuantity === 0 ? "Out of Stock — Hết hàng. Vui lòng xóa sản phẩm." : "Tình trạng hàng đã thay đổi. Vui lòng giảm số lượng."}</p>}
          <div className={styles.bagActions}><div className={styles.quantity}><button type="button" aria-label={`Decrease quantity of ${item.name}`} disabled={busy || item.quantity <= 1 || item.maxQuantity === 0} onClick={() => void setQuantity(item.variantId, Math.max(1, Math.min(item.quantity - 1, item.maxQuantity)))}><Minus size={14} /></button><output aria-label={`Quantity of ${item.name}`}>{item.quantity}</output><button type="button" aria-label={`Increase quantity of ${item.name}`} disabled={busy || item.quantity >= item.maxQuantity} onClick={() => void setQuantity(item.variantId, item.quantity + 1)}><Plus size={14} /></button></div>
          <button type="button" className={styles.bagRemove} disabled={busy} onClick={() => void setQuantity(item.variantId, 0)} aria-label={`Remove ${item.name} from bag`}><Trash2 size={15} />Remove</button></div>
        </div></li>)}</ul>
    </div>
    {!!items.length && <footer className={styles.bagFooter}><p className={styles.bagTotal}>SUBTOTAL <strong>{money.format(items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</strong></p><p>Thanh toán chưa khả dụng.</p><button type="button" className={styles.addButton} onClick={close}>CONTINUE SHOPPING</button></footer>}
  </dialog>;
}
export default function CartBag({ text = false }: { text?: boolean }) {
  const [open, setOpen] = useState(false);
  const items = useCartStore(state => state.items);
  useEffect(() => { void useCartStore.getState().sync(); }, []);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return <><button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Open shopping bag${count ? `, ${count} items` : ""}`} className={text ? styles.viewBag : undefined}><ShoppingBag size={19} strokeWidth={1.5} />{text ? `VIEW BAG (${count})` : count > 0 ? <span>{count}</span> : null}</button>{open && <BagDialog close={() => setOpen(false)} />}</>;
}
