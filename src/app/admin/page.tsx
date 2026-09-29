import { dashboardService } from "@/features/dashboard/services/dashboard.service";
import DashboardStatCard from "@/components/admin/dashboard/DashboardStatCard";
import TopProductsCard from "@/components/admin/dashboard/TopProductsCard";
import RecentOrdersCard from "@/components/admin/dashboard/RecentOrdersCard";
import LowStockCard from "@/components/admin/dashboard/LowStockCard";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN").format(value);
};

export default async function AdminPage() {
  const overview = await dashboardService.getOverview();

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardStatCard
          label="Revenue"
          value={`${formatCurrency(overview.summary.revenue)} ₫`}
        />

        <DashboardStatCard
          label="Orders"
          value={overview.summary.ordersCount.toString()}
        />

        <DashboardStatCard
          label="Products Sold"
          value={overview.summary.productsSold.toString()}
        />

        <DashboardStatCard
          label="Customers"
          value={overview.summary.customersCount.toString()}
        />

        <DashboardStatCard
          label="AOV"
          value={`${formatCurrency(overview.aov)} ₫`}
        />
      </div>
       <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TopProductsCard products={overview.topProducts} />

        <RecentOrdersCard orders={overview.recentOrders} />
      </div>
      <div className="mt-6">
        <LowStockCard items={overview.lowStock} />
      </div>
    </section>
  );
}