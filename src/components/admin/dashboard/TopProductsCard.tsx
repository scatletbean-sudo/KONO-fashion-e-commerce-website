type TopProduct = {
  productId: string;
  name: string;
  slug: string | null;
  status: string | null;
  quantitySold: number;
  revenue: number;
};

type TopProductsCardProps = {
  products: TopProduct[];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN").format(value);
};

export default function TopProductsCard({
  products,
}: TopProductsCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-sm font-medium text-neutral-950">
          Top Products
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          Best-selling products by quantity
        </p>
      </div>

      <div className="divide-y divide-neutral-100">
        {products.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">
            No product sales yet.
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.productId}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-950">
                  {product.name}
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  {product.quantitySold} sold
                </p>
              </div>

              <p className="shrink-0 text-sm font-medium text-neutral-950">
                {formatCurrency(product.revenue)} ₫
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}