"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { DateRangePicker } from "@/components/admin/DateRangePicker";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  payment: {
    status: string;
  } | null;
  shipment: {
    status: string;
  } | null;
  _count: {
    items: number;
  };
};

type OrdersResponse = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DateRangeValue = {
  dateFrom?: string;
  dateTo?: string;
};

const STATUS_OPTIONS: Array<{
  value: OrderStatus | "";
  label: string;
}> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

const formatCurrency = (value: number, currency = "VND") => {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ${
    currency === "VND" ? "₫" : currency
  }`;
};

const formatDate = (value: string) => {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const getStatusLabel = (status: OrderStatus) => {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
};

export default function OrdersList() {
  const [data, setData] = useState<OrdersResponse>({
    orders: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});

  const [sortBy, setSortBy] = useState<
    "createdAt" | "totalAmount"
  >("createdAt");

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    "desc",
  );

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      params.set("page", page.toString());
      params.set("pageSize", data.pageSize.toString());
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (status) {
        params.set("status", status);
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (dateRange.dateFrom) {
        params.set("dateFrom", dateRange.dateFrom);
      }

      if (dateRange.dateTo) {
        params.set("dateTo", dateRange.dateTo);
      }

      const response = await fetch(
        `/api/admin/orders?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ?? "Failed to load orders",
        );
      }

      setData(result);
    } catch (err) {
      console.error("ORDERS LIST ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load orders",
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    data.pageSize,
    sortBy,
    sortOrder,
    status,
    search,
    dateRange.dateFrom,
    dateRange.dateTo,
  ]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setPage(1);
  };

  const handleStatusChange = (
    value: OrderStatus | "",
  ) => {
    setStatus(value);
    setPage(1);
  };

  const handleDateRangeChange = (
    value: DateRangeValue,
  ) => {
    setDateRange(value);
    setPage(1);
  };

  const handleSort = (
    field: "createdAt" | "totalAmount",
  ) => {
    setPage(1);

    if (sortBy === field) {
      setSortOrder((current) =>
        current === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortBy(field);
    setSortOrder("desc");
  };

  const handlePageSizeChange = (
    value: number,
  ) => {
    setPage(1);

    setData((current) => ({
      ...current,
      pageSize: value,
    }));
  };

  const getSortIcon = (
    field: "createdAt" | "totalAmount",
  ) => {
    if (sortBy !== field) {
      return "↕";
    }

    return sortOrder === "asc" ? "↑" : "↓";
  };

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          Orders
        </p>

        <h2 className="mt-2 text-2xl font-medium tracking-tight text-neutral-950">
          All Orders
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Manage and monitor all orders placed in your store.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <form
              onSubmit={handleSearch}
              className="flex w-full max-w-xl gap-2"
            >
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search order number, customer name or email..."
                className="h-10 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-neutral-900"
              />

              <button
                type="submit"
                className="h-10 rounded-md bg-neutral-950 px-5 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Search
              </button>
            </form>

            <select
              value={status}
              onChange={(event) =>
                handleStatusChange(
                  event.target.value as OrderStatus | "",
                )
              }
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
            />

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("");
                setDateRange({});
                setPage(1);
              }}
              className="text-sm text-neutral-500 transition hover:text-black"
            >
              Reset filters
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-neutral-950">
              Orders
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {data.total} total orders
            </p>
          </div>

          {loading && (
            <span className="text-xs text-neutral-400">
              Loading...
            </span>
          )}
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr className="text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-5 py-3 font-medium">
                  Order
                </th>

                <th className="px-5 py-3 font-medium">
                  Customer
                </th>

                <th className="px-5 py-3 font-medium">
                  Status
                </th>

                <th className="px-5 py-3 font-medium">
                  Items
                </th>

                <th className="px-5 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() =>
                      handleSort("totalAmount")
                    }
                    className="flex items-center gap-1 hover:text-black"
                  >
                    Total
                    <span>
                      {getSortIcon("totalAmount")}
                    </span>
                  </button>
                </th>

                <th className="px-5 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() =>
                      handleSort("createdAt")
                    }
                    className="flex items-center gap-1 hover:text-black"
                  >
                    Date
                    <span>
                      {getSortIcon("createdAt")}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {!loading && data.orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center"
                  >
                    <p className="text-sm font-medium text-neutral-700">
                      No orders found
                    </p>

                    <p className="mt-1 text-xs text-neutral-400">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}

              {data.orders.map((order) => (
                <tr
                  key={order.id}
                  className="transition hover:bg-neutral-50"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-neutral-950">
                      {order.orderNumber}
                    </p>

                    <p className="mt-1 text-xs text-neutral-400">
                      {order.id}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm text-neutral-900">
                      {order.customerName}
                    </p>

                    <p className="mt-1 text-xs text-neutral-400">
                      {order.customerEmail}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700">
                      {getStatusLabel(order.status)}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-sm text-neutral-600">
                    {order._count.items}
                  </td>

                  <td className="px-5 py-4 text-sm font-medium text-neutral-950">
                    {formatCurrency(
                      order.totalAmount,
                      order.currency,
                    )}
                  </td>

                  <td className="px-5 py-4 text-sm text-neutral-600">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-neutral-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span>Rows per page</span>

            <select
              value={data.pageSize}
              onChange={(event) =>
                handlePageSizeChange(
                  Number(event.target.value),
                )
              }
              className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() =>
                setPage((current) => current - 1)
              }
              className="h-9 rounded-md border border-neutral-300 px-3 text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="min-w-[100px] text-center text-sm text-neutral-500">
              Page {data.page} of{" "}
              {Math.max(data.totalPages, 1)}
            </span>

            <button
              type="button"
              disabled={
                page >= data.totalPages || loading
              }
              onClick={() =>
                setPage((current) => current + 1)
              }
              className="h-9 rounded-md border border-neutral-300 px-3 text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}