"use client";

import { useState } from "react";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

type OrderStatusActionsProps = {
  orderId: string;
  currentStatus: OrderStatus;
  onUpdated?: () => void;
};

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export default function OrderStatusActions({
  orderId,
  currentStatus,
  onUpdated,
}: OrderStatusActionsProps) {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatus | null>(null);

  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableStatuses = nextStatuses[currentStatus];

  const closeModal = () => {
    if (loading) return;

    setSelectedStatus(null);
    setCarrier("");
    setTrackingNumber("");
    setNote("");
    setError("");
  };

  const handleUpdate = async () => {
    if (!selectedStatus) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: selectedStatus,
            ...(carrier.trim()
              ? { carrier: carrier.trim() }
              : {}),
            ...(trackingNumber.trim()
              ? {
                  trackingNumber: trackingNumber.trim(),
                }
              : {}),
            ...(note.trim()
              ? { note: note.trim() }
              : {}),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update order status",
        );
      }

      closeModal();
      setOpen(false);

      onUpdated?.();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update order status",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Order Actions
        </button>

        {open && (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
            {availableStatuses.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500">
                No available actions
              </div>
            ) : (
              availableStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(status);
                    setOpen(false);
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-100"
                >
                  Change to {statusLabels[status]}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="text-lg font-medium">
                Change Order Status
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                {statusLabels[currentStatus]} →{" "}
                {statusLabels[selectedStatus]}
              </p>
            </div>

            <div className="space-y-4 p-5">
              {selectedStatus === "SHIPPED" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Carrier
                    </label>

                    <input
                      value={carrier}
                      onChange={(event) =>
                        setCarrier(event.target.value)
                      }
                      placeholder="GHN, GHTK, Viettel Post..."
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Tracking Number
                    </label>

                    <input
                      value={trackingNumber}
                      onChange={(event) =>
                        setTrackingNumber(event.target.value)
                      }
                      placeholder="Enter tracking number"
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Note
                </label>

                <textarea
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  rows={3}
                  placeholder="Optional note..."
                  className="w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4">
              <button
                type="button"
                disabled={loading}
                onClick={closeModal}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleUpdate}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {loading ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}