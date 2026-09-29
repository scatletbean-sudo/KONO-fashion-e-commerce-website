"use client";

import { useState } from "react";

import DashboardStatCard from "@/components/admin/dashboard/DashboardStatCard";
import TopProductsCard from "@/components/admin/dashboard/TopProductsCard";
import RecentOrdersCard from "@/components/admin/dashboard/RecentOrdersCard";
import LowStockCard from "@/components/admin/dashboard/LowStockCard";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

type DashboardOverviewData = {
  summary: {
    revenue: number;
    ordersCount: number;
    productsSold: number;
    customersCount: number;
    inventoryLowStock: number;
    inventoryOutOfStock: number;
  };
  aov: number;
  topProducts: Array<{
    productId: string;
    name: string;
    slug: string | null;
    status: string | null;
    quantitySold: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    status: string;
    totalAmount: number;
    currency: string;
    createdAt: Date;
  }>;
  lowStock: Array<{
    inventoryId: string;
    variantId: string;
    sku: string;
    productId: string;
    productName: string;
    quantity: number;
    lowStockAt: number;
  }>;
};

type DateRangeValue = {
  dateFrom?: string;
  dateTo?: string;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN").format(value);
};

export default function DashboardOverview({
  initialOverview,
}: {
  initialOverview: DashboardOverviewData;
}) {
  const [overview, setOverview] =
    useState<DashboardOverviewData>(initialOverview);

  const [dateRange, setDateRange] =
    useState<DateRangeValue>({});

  const [loading, setLoading] = useState(false);

  const handleDateRangeChange = async (range: DateRangeValue) => {
    setDateRange(range);

    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (range.dateFrom) {
        params.set("dateFrom", range.dateFrom);
      }

      if (range.dateTo) {
        params.set("dateTo", range.dateTo);
      }

      const query = params.toString();

      const response = await fetch(
        `/api/dashboard/summary${query ? `?${query}` : ""}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load dashboard");
      }

      const data = await response.json();
      
      setOverview({
        ...data,
        recentOrders: data.recentOrders.map(
          (order: DashboardOverviewData["recentOrders"][number]) => ({
            ...order,
            createdAt: new Date(order.createdAt),
          }),
        ),
      });
    } catch (error) {
      console.error("DASHBOARD FILTER ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
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

        <DateRangePicker
          value={dateRange}
          onChange={handleDateRangeChange}
        />
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-8 backdrop-blur-[1px]">
            <span className="text-sm text-neutral-500">
              Updating dashboard...
            </span>
          </div>
        )}

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
      </div>
    </section>
  );
}