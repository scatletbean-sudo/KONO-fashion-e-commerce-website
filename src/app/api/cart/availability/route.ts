import { cartService } from "@/features/cart/cart.service";
import { CartError } from "@/features/cart/cart-contract";
import { cartOwner, cartResponse, cartError } from "@/features/cart/cart-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const variantId = new URL(request.url).searchParams.get("variantId");
    if (!variantId || variantId.length > 128) throw new CartError("Phiên bản không hợp lệ.");
    return cartResponse(await cartService.availability(variantId, await cartOwner()));
  } catch (error) { return cartError(error); }
}
