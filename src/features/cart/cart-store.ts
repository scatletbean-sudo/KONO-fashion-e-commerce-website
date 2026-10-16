"use client";
import { create } from "zustand";
import { z } from "zod";
import { cartSchema, type CartSnapshot } from "./cart-contract";
export async function cartRequest<T>(url: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const timeout = AbortSignal.timeout(15000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try { response = await fetch(url, { ...init, signal, credentials: "same-origin", cache: "no-store" }); } catch { throw new Error("Không thể kết nối. Vui lòng thử lại."); }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) throw new Error(typeof body?.message === "string" ? body.message : "Chưa thể cập nhật giỏ hàng.");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) throw new Error("Phản hồi giỏ hàng không hợp lệ. Vui lòng tải lại.");
  return parsed.data;
}
type State = CartSnapshot & { busy: boolean; error: string; notice: string; sync: () => Promise<void>; setQuantity: (variantId: string, quantity: number) => Promise<boolean> };
export const useCartStore = create<State>((set, get) => ({
  items: [], busy: false, error: "", notice: "",
  sync: async () => {
    if (get().busy) return;
    set({ busy: true, error: "", notice: "" });
    try { const before = get().items; const next = await cartRequest("/api/cart", cartSchema); const changed = before.length > 0 && JSON.stringify(before) !== JSON.stringify(next.items); set({ ...next, notice: changed ? "Giỏ hàng đã cập nhật giá và tình trạng sản phẩm. Vui lòng kiểm tra lại." : "" }); } catch (error) { set({ error: error instanceof Error ? error.message : "Chưa thể tải giỏ hàng." }); } finally { set({ busy: false }); }
  },
  setQuantity: async (variantId, quantity) => {
    if (get().busy) return false;
    set({ busy: true, error: "", notice: "" });
    try { set(await cartRequest("/api/cart", cartSchema, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, quantity }) })); return true; }
    catch (error) { set({ error: error instanceof Error ? error.message : "Chưa thể cập nhật giỏ hàng." }); return false; }
    finally { set({ busy: false }); }
  },
}));
