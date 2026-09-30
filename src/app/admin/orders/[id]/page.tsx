"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type OrderItem = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
};

type Payment = {
  id: string;
  method: string;
  status: string;
  amount: number;
  transactionId: string | null;
  providerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
};

type Shipment = {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippingAddress: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};
type OrderStatusHistory = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  changedById: string | null;
  createdAt: string;
  changedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;

  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;

  customerEmail: string;
  customerPhone: string;
  customerName: string;

  notes: string | null;

  createdAt: string;
  updatedAt: string;

  items: OrderItem[];
  payment: Payment | null;
  shipment: Shipment | null;
  statusHistory: OrderStatusHistory[];

  couponUsages: unknown[];
  user: unknown | null;
  address: unknown | null;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function statusClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700";

    case "CONFIRMED":
      return "bg-blue-50 text-blue-700";

    case "PROCESSING":
      return "bg-violet-50 text-violet-700";

    case "SHIPPED":
      return "bg-indigo-50 text-indigo-700";

    case "DELIVERED":
      return "bg-emerald-50 text-emerald-700";

    case "CANCELLED":
      return "bg-red-50 text-red-700";

    case "REFUNDED":
      return "bg-neutral-100 text-neutral-700";

    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

function paymentStatusClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700";

    case "FAILED":
      return "bg-red-50 text-red-700";

    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "bg-neutral-100 text-neutral-700";

    default:
      return "bg-amber-50 text-amber-700";
  }
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/admin/orders/${params.id}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ?? "Failed to load order",
          );
        }

        setOrder(data);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load order",
        );
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadOrder();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-sm text-neutral-500">
          Loading order...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8">
        <Link
          href="/admin/orders"
          className="text-sm text-neutral-500 hover:text-black"
        >
          ← Back to Orders
        </Link>

        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-medium text-red-700">
            Failed to load order
          </h1>

          <p className="mt-2 text-sm text-red-600">
            {error ?? "Order not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-sm text-neutral-500 hover:text-black"
          >
            ← Back to Orders
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-medium tracking-tight">
              {order.orderNumber}
            </h1>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                order.status,
              )}`}
            >
              {order.status}
            </span>
          </div>

          <p className="mt-1 text-sm text-neutral-500">
            Created {formatDate(order.createdAt)}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Print
          </button>

          <button
            type="button"
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
          >
            Order Actions
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Order Items */}
          <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-medium">Order Items</h2>

              <p className="mt-1 text-sm text-neutral-500">
                {order.items.length}{" "}
                {order.items.length === 1 ? "item" : "items"}
              </p>
            </div>

            <div className="divide-y divide-neutral-200">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
                >
                  <div>
                    <p className="font-medium">
                      {item.productName}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      SKU: {item.sku}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      Variant ID: {item.variantId}
                    </p>
                  </div>

                  <div className="text-sm text-neutral-500">
                    Qty: {item.quantity}
                  </div>

                  <div className="text-sm">
                    {formatMoney(
                      item.unitPrice,
                      order.currency,
                    )}
                  </div>

                  <div className="text-right font-medium">
                    {formatMoney(
                      item.totalPrice,
                      order.currency,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Customer */}
          <section className="rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-medium">Customer</h2>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  Name
                </p>

                <p className="mt-1 text-sm font-medium">
                  {order.customerName}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  Email
                </p>

                <p className="mt-1 text-sm">
                  {order.customerEmail}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  Phone
                </p>

                <p className="mt-1 text-sm">
                  {order.customerPhone}
                </p>
              </div>
            </div>
          </section>

          {/* Notes */}
          {order.notes && (
            <section className="rounded-lg border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="font-medium">Notes</h2>
              </div>

              <div className="p-5 text-sm text-neutral-600">
                {order.notes}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* Order Summary */}
          <section className="rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-medium">Order Summary</h2>
            </div>

            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">
                  Subtotal
                </span>

                <span>
                  {formatMoney(
                    order.subtotal,
                    order.currency,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-500">
                  Discount
                </span>

                <span>
                  -
                  {formatMoney(
                    order.discountAmount,
                    order.currency,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-500">
                  Shipping
                </span>

                <span>
                  {formatMoney(
                    order.shippingAmount,
                    order.currency,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-500">
                  Tax
                </span>

                <span>
                  {formatMoney(
                    order.taxAmount,
                    order.currency,
                  )}
                </span>
              </div>

              <div className="border-t border-neutral-200 pt-3">
                <div className="flex justify-between text-base font-medium">
                  <span>Total</span>

                  <span>
                    {formatMoney(
                      order.totalAmount,
                      order.currency,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-medium">Payment</h2>
            </div>

            {order.payment ? (
              <div className="space-y-4 p-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Method
                  </span>

                  <span className="font-medium">
                    {order.payment.method}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Status
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatusClass(
                      order.payment.status,
                    )}`}
                  >
                    {order.payment.status}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Amount
                  </span>

                  <span>
                    {formatMoney(
                      order.payment.amount,
                      order.currency,
                    )}
                  </span>
                </div>

                {order.payment.transactionId && (
                  <div>
                    <p className="text-neutral-500">
                      Transaction ID
                    </p>

                    <p className="mt-1 break-all">
                      {order.payment.transactionId}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 text-sm text-neutral-500">
                No payment information.
              </div>
            )}
          </section>

          {/* Shipping */}
          <section className="rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-medium">Shipping</h2>
            </div>

            {order.shipment ? (
              <div className="space-y-4 p-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Status
                  </span>

                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium">
                    {order.shipment.status}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Carrier
                  </span>

                  <span>
                    {order.shipment.carrier ?? "—"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Tracking
                  </span>

                  <span>
                    {order.shipment.trackingNumber ?? "—"}
                  </span>
                </div>

                {order.shipment.shippingAddress && (
                  <div>
                    <p className="text-neutral-500">
                      Shipping Address
                    </p>

                    <p className="mt-1 leading-6">
                      {order.shipment.shippingAddress}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 text-sm text-neutral-500">
                No shipment information.
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Timeline */}

<section className="rounded-lg border border-neutral-200 bg-white">
  <div className="border-b border-neutral-200 px-5 py-4">
    <h2 className="font-medium">Order Timeline</h2>
  </div>

  <div className="space-y-5 p-5">
    {/* Order created */}
    <div className="flex gap-4">
      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-black" />

      <div className="min-w-0">
        <p className="text-sm font-medium">
          Order created
        </p>

        <p className="mt-1 text-sm text-neutral-500">
          {formatDate(order.createdAt)}
        </p>
      </div>
    </div>

    {/* Status history */}
    {order.statusHistory.map((history) => (
      <div
        key={history.id}
        className="flex gap-4"
      >
        <div
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            history.toStatus === order.status
              ? "bg-black"
              : "bg-neutral-300"
          }`}
        />

        <div className="min-w-0">
          <p className="text-sm font-medium">
            {history.fromStatus
              ? `${history.fromStatus} → ${history.toStatus}`
              : `Status changed to ${history.toStatus}`}
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            {formatDate(history.createdAt)}
          </p>

          {history.changedBy && (
            <p className="mt-1 text-xs text-neutral-400">
              By{" "}
              {[
                history.changedBy.firstName,
                history.changedBy.lastName,
              ]
                .filter(Boolean)
                .join(" ") || history.changedBy.email}
            </p>
          )}

          {history.note && (
            <p className="mt-2 text-sm text-neutral-600">
              {history.note}
            </p>
          )}
        </div>
      </div>
    ))}
  </div>
</section>
    </div>
  );
}