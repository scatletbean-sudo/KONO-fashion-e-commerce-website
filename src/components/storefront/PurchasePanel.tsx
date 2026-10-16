"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { availabilitySchema, type Availability } from "@/features/cart/cart-contract";
import { cartRequest, useCartStore } from "@/features/cart/cart-store";
import type { StorefrontProduct } from "./catalog";
import CartBag from "./CartBag";
import styles from "./product-detail.module.css";

type Variant = StorefrontProduct["variants"][number];
export default function PurchasePanel({ variant }: { variant: Variant | null }) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const busy = useCartStore(state => state.busy);
  const cartItems = useCartStore(state => state.items);
  const lock = useRef(false);
  useEffect(() => {
    if (!variant) return;
    const controller = new AbortController();
    cartRequest(`/api/cart/availability?variantId=${encodeURIComponent(variant.id)}`, availabilitySchema, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setAvailability(data); setError(""); } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Chưa thể kiểm tra tồn kho."); });
    return () => controller.abort();
  }, [variant, attempt, cartItems]);
  const remaining = Math.max(0, (availability?.maxQuantity ?? 0) - (availability?.currentQuantity ?? 0));
  const selectedQuantity = Math.max(1, Math.min(quantity, remaining));
  const canAdd = !!variant?.inStock && !!availability?.inStock && remaining > 0 && !busy && !error;
  async function add() {
    if (!canAdd || lock.current || !availability) return;
    lock.current = true; setMessage("");
    try {
      const target = availability.currentQuantity + selectedQuantity;
      const success = await useCartStore.getState().setQuantity(availability.variantId, target);
      if (success) {
        const item = useCartStore.getState().items.find(item => item.variantId === availability.variantId);
        setAvailability({ ...availability, currentQuantity: item?.quantity ?? target, maxQuantity: item?.maxQuantity ?? availability.maxQuantity, price: item?.price ?? availability.price });
        setMessage("Đã thêm vào giỏ hàng.");
      } else setError(useCartStore.getState().error || "Chưa thể thêm vào giỏ hàng.");
    } finally { lock.current = false; }
  }
  return <div className={styles.purchase}>
    <div className={styles.quantityRow}><span>SỐ LƯỢNG</span><div className={styles.quantity}><button type="button" aria-label="Decrease quantity" disabled={busy || selectedQuantity <= 1} onClick={() => setQuantity(selectedQuantity - 1)}><Minus size={14} /></button><output aria-label="Quantity">{availability ? selectedQuantity : 1}</output><button type="button" aria-label="Increase quantity" disabled={busy || !!error || !availability || selectedQuantity >= remaining} onClick={() => setQuantity(selectedQuantity + 1)}><Plus size={14} /></button></div></div>
    {availability && <p className={styles.purchaseNote} role="status">{availability.lowStock ? "Low Stock \u2014 S\u1eafp h\u1ebft h\u00e0ng" : availability.inStock ? "In Stock — Còn hàng" : "Out of Stock — Hết hàng"}</p>}
    <div className={styles.buyBar}><button type="button" className={styles.addButton} disabled={!canAdd} onClick={() => void add()}><ShoppingBag size={17} />{busy ? "ĐANG XỬ LÝ…" : "ADD TO BAG"}</button></div>
    {!variant && <p className={styles.purchaseNote}>Chọn phiên bản màu / size để thêm vào giỏ.</p>}{variant && !availability && !error && <p role="status" className={styles.purchaseNote}>Đang kiểm tra giá và tồn kho…</p>}
    <div className={styles.purchaseFeedback}>{message && <div role="status" className={styles.purchaseMessage}>{message}<CartBag text /></div>}{error && <div role="alert" className={styles.purchaseMessage}><p>{error}</p><button type="button" disabled={busy} onClick={() => { setError(""); setAvailability(null); setAttempt(current => current + 1); }}>Kiểm tra lại tồn kho</button></div>}</div>
  </div>;
}
