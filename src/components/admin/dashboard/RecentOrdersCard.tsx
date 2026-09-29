type RecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: Date;
};

type RecentOrdersCardProps = {
  orders: RecentOrder[];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN").format(value);
};

const formatDate = (value: Date) => {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

export default function RecentOrdersCard({
  orders,
}: RecentOrdersCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-sm font-medium text-neutral-950">
          Recent Orders
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          Latest orders placed in your store
        </p>
      </div>

      <div className="divide-y divide-neutral-100">
        {orders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">
            No orders yet.
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-950">
                  {order.orderNumber}
                </p>

                <p className="mt-1 truncate text-xs text-neutral-500">
                  {order.customerName} · {formatDate(order.createdAt)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-neutral-950">
                  {formatCurrency(order.totalAmount)} ₫
                </p>

                <p className="mt-1 text-xs uppercase tracking-wide text-neutral-400">
                  {order.status}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}