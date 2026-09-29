type LowStockItem = {
  inventoryId: string;
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  quantity: number;
  lowStockAt: number;
};

type LowStockCardProps = {
  items: LowStockItem[];
};

export default function LowStockCard({
  items,
}: LowStockCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-sm font-medium text-neutral-950">
          Low Stock
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          Products that need restocking
        </p>
      </div>

      <div className="divide-y divide-neutral-100">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">
            No low stock items.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.inventoryId}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-950">
                  {item.productName}
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  SKU: {item.sku}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-neutral-950">
                  {item.quantity} left
                </p>

                <p className="mt-1 text-xs text-neutral-400">
                  Alert at {item.lowStockAt}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}