import { NextResponse } from "next/server";
import { AttributeReferenceError } from "@/features/products/attributes/attribute-errors";

// Only explicitly known business errors can be sent to the client.
export function attributeErrorResponse(error: unknown) {
  if (error instanceof AttributeReferenceError) {
    return NextResponse.json({ success: false, message: error.message, errors: { fieldErrors: { [error.field]: [error.message] } } }, { status: 400 });
  }
  if (error instanceof Error && /^(Category|Collection|Color|Size) (name|slug) already exists$/.test(error.message)) {
    return NextResponse.json({ success: false, message: error.message }, { status: 409 });
  }
  if (error instanceof Error && /^(Category|Collection|Color|Size) is in use/.test(error.message)) {
    return NextResponse.json({ success: false, message: error.message }, { status: 409 });
  }
  if (error && typeof error === "object" && "code" in error && (error.code === "P2003" || error.code === "P2014")) {
    return NextResponse.json({ success: false, message: "This record is referenced by other data and cannot be deleted. Reload attributes; set Category or Collection Inactive instead." }, { status: 409 });
  }
  if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
    return NextResponse.json({ success: false, message: "This record no longer exists. Reload attributes before trying again." }, { status: 404 });
  }
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return NextResponse.json({ success: false, message: "An attribute slug or product SKU already exists." }, { status: 409 });
  }
  const rawConflict = error && typeof error === "object" && "code" in error && error.code === "P2010" && "meta" in error && error.meta && typeof error.meta === "object" && "code" in error.meta && ["40001", "40P01", "55P03"].includes(String(error.meta.code));
  if (error && typeof error === "object" && "code" in error && (error.code === "P2034" || error.code === "P2028" || rawConflict)) {
    return NextResponse.json({ success: false, message: "Data changed during saving or the save timed out. Reload and try again." }, { status: 409 });
  }
  return null;
}
