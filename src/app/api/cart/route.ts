import { cartService } from "@/features/cart/cart.service";
import { cartInput, CartError } from "@/features/cart/cart-contract";
import { assertCartOrigin, cartOwner, newCartOwner, cartResponse, cartError } from "@/features/cart/cart-http";
export const runtime = "nodejs";
export async function GET() {
  try { return cartResponse(await cartService.read(await cartOwner())); } catch (error) { return cartError(error); }
}
// Absolute quantity makes retried writes idempotent; the client never supplies a price or owner ID.
export async function PUT(request: Request) {
  try {
    assertCartOrigin(request);
    const input = cartInput.safeParse(await request.json());
    if (!input.success) throw new CartError("Số lượng hoặc phiên bản không hợp lệ.");
    const owner = await cartOwner();
    if (!owner && input.data.quantity === 0) return cartResponse({ items: [] });
    const fresh = owner ? null : newCartOwner();
    const data = await cartService.setQuantity(owner ?? fresh!.sessionId, input.data.variantId, input.data.quantity);
    return cartResponse(data, fresh?.token);
  } catch (error) { return cartError(error); }
}
