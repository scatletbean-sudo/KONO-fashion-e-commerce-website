"use client";

import {
  Bell,
  Menu,
  Search,
} from "lucide-react";
import { usePathname } from "next/navigation";

type AdminHeaderProps = {
  onMenuClick?: () => void;
};

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",

  "/admin/products": "All Products",
  "/admin/products/create": "Create Product",
  "/admin/products/categories": "Categories",
  "/admin/products/collections": "Collections",
  "/admin/products/colors": "Colors",
  "/admin/products/sizes": "Sizes",
  "/admin/products/reviews": "Product Reviews",

  "/admin/inventory": "Inventory",
  "/admin/inventory/stock": "Stock",
  "/admin/inventory/low-stock": "Low Stock",
  "/admin/inventory/out-of-stock": "Out of Stock",
  "/admin/inventory/stock-in/new": "New Receipt",
  "/admin/inventory/stock-in/history": "Receipt History",
  "/admin/inventory/adjustment": "Stock Adjustment",
  "/admin/inventory/movements": "Movement History",

  "/admin/orders": "All Orders",
  "/admin/orders/draft": "Draft Orders",
  "/admin/orders/pending": "Pending",
  "/admin/orders/confirmed": "Confirmed",
  "/admin/orders/processing": "Processing",
  "/admin/orders/shipped": "Shipped",
  "/admin/orders/delivered": "Delivered",
  "/admin/orders/cancelled": "Cancelled",
  "/admin/orders/returns": "Returns",
  "/admin/orders/refunds": "Refunds",

  "/admin/customers": "All Customers",
  "/admin/customers/detail": "Customer Detail",
  "/admin/customers/order-history": "Order History",
  "/admin/customers/segments": "Customer Segments",
  "/admin/customers/export": "Customer Export",

  "/admin/marketing/coupons": "Coupons",
  "/admin/marketing/promotions": "Promotions",
  "/admin/marketing/campaigns": "Campaigns",
  "/admin/marketing/gift-cards": "Gift Cards",

  "/admin/analytics/sales": "Sales",
  "/admin/analytics/products": "Products",
  "/admin/analytics/customers": "Customers",
  "/admin/analytics/inventory": "Inventory",
  "/admin/analytics/orders": "Orders",
  "/admin/analytics/marketing": "Marketing",

  "/admin/fulfillment/shipments": "Shipments",
  "/admin/fulfillment/shipping-methods": "Shipping Methods",
  "/admin/fulfillment/tracking": "Tracking",
  "/admin/fulfillment/delivery-status": "Delivery Status",

  "/admin/finance/revenue": "Revenue",
  "/admin/finance/payments": "Payments",
  "/admin/finance/refunds": "Refunds",
  "/admin/finance/taxes": "Taxes",
  "/admin/finance/transactions": "Transaction History",

  "/admin/content/homepage": "Homepage",
  "/admin/content/banners": "Banners",
  "/admin/content/lookbook": "Lookbook",
  "/admin/content/editorial": "Editorial",
  "/admin/content/media": "Media Library",

  "/admin/settings/store": "Store",
  "/admin/settings/admin-users": "Admin Users",
  "/admin/settings/roles": "Roles & Permissions",
  "/admin/settings/payment": "Payment",
  "/admin/settings/shipping": "Shipping",
  "/admin/settings/tax": "Tax",
  "/admin/settings/notifications": "Notifications",
  "/admin/settings/general": "General",
};

function getPageTitle(pathname: string) {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  const matchedPath = Object.keys(pageTitles)
    .filter((path) => path !== "/admin")
    .find((path) => pathname.startsWith(`${path}/`));

  return matchedPath
    ? pageTitles[matchedPath]
    : "Dashboard";
}

export default function AdminHeader({
  onMenuClick,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6 lg:px-8">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu
            className="h-5 w-5"
            strokeWidth={1.8}
          />
        </button>

        <div className="hidden sm:block">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            Administration
          </p>

          <h1 className="mt-1 text-lg font-medium tracking-tight text-neutral-950">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm text-neutral-500 transition hover:bg-neutral-50"
          aria-label="Search"
        >
          <Search
            className="h-4 w-4"
            strokeWidth={1.8}
          />

          <span className="hidden md:inline">
            Search
          </span>

          <kbd className="hidden rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-400 lg:inline">
            /
          </kbd>
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100"
          aria-label="Notifications"
        >
          <Bell
            className="h-5 w-5"
            strokeWidth={1.8}
          />

          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-neutral-950" />
        </button>

        {/* Admin profile */}
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-xs font-medium text-white">
            A
          </div>

          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-neutral-950">
              Admin
            </p>

            <p className="text-xs text-neutral-400">
              Administrator
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}