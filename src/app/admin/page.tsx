export default function AdminPage() {
  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          Overview
        </p>

        <h2 className="mt-2 text-2xl font-medium tracking-tight text-neutral-950">
          Welcome to KONO Admin
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Manage your store, products, orders, inventory,
          customers and business operations from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">
            Revenue
          </p>

          <p className="mt-3 text-2xl font-medium text-neutral-950">
            —
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">
            Orders
          </p>

          <p className="mt-3 text-2xl font-medium text-neutral-950">
            —
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">
            Products Sold
          </p>

          <p className="mt-3 text-2xl font-medium text-neutral-950">
            —
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">
            Customers
          </p>

          <p className="mt-3 text-2xl font-medium text-neutral-950">
            —
          </p>
        </div>
      </div>
    </section>
  );
}