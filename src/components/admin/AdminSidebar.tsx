"use client";

import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

type AdminSidebarProps = {
  onNavigate?: () => void;
};

type MenuItem = {
  label: string;
  href: string;
};

type MenuGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { label: "Overview", href: "/admin" },
      { label: "Sales Analytics", href: "/admin/dashboard/sales" },
      { label: "Revenue", href: "/admin/dashboard/revenue" },
      { label: "Orders", href: "/admin/dashboard/orders" },
      { label: "Products Sold", href: "/admin/dashboard/products-sold" },
      { label: "Customers", href: "/admin/dashboard/customers" },
      { label: "AOV", href: "/admin/dashboard/aov" },
      { label: "Top Products", href: "/admin/dashboard/top-products" },
      { label: "Recent Orders", href: "/admin/dashboard/recent-orders" },
      { label: "Low Stock", href: "/admin/dashboard/low-stock" },
    ],
  },

  {
    label: "Orders",
    icon: ShoppingCart,
    items: [
      { label: "All Orders", href: "/admin/orders" },
      { label: "Draft Orders", href: "/admin/orders/draft" },
      { label: "Pending", href: "/admin/orders/pending" },
      { label: "Confirmed", href: "/admin/orders/confirmed" },
      { label: "Processing", href: "/admin/orders/processing" },
      { label: "Shipped", href: "/admin/orders/shipped" },
      { label: "Delivered", href: "/admin/orders/delivered" },
      { label: "Cancelled", href: "/admin/orders/cancelled" },
      { label: "Returns", href: "/admin/orders/returns" },
      { label: "Refunds", href: "/admin/orders/refunds" },
    ],
  },

  {
    label: "Products",
    icon: Package,
    items: [
      { label: "All Products", href: "/admin/products" },
      { label: "Create Product", href: "/admin/products/create" },
      { label: "Categories", href: "/admin/products/categories" },
      { label: "Collections", href: "/admin/products/collections" },
      { label: "Colors", href: "/admin/products/colors" },
      { label: "Sizes", href: "/admin/products/sizes" },
      { label: "Product Reviews", href: "/admin/products/reviews" },
    ],
  },

  {
    label: "Inventory",
    icon: ClipboardList,
    items: [
      { label: "Overview", href: "/admin/inventory" },
      { label: "Stock", href: "/admin/inventory/stock" },
      { label: "Low Stock", href: "/admin/inventory/low-stock" },
      { label: "Out of Stock", href: "/admin/inventory/out-of-stock" },
      { label: "New Receipt", href: "/admin/inventory/stock-in/new" },
      { label: "Receipt History", href: "/admin/inventory/stock-in/history" },
      { label: "Stock Adjustment", href: "/admin/inventory/adjustment" },
      { label: "Movement History", href: "/admin/inventory/movements" },
    ],
  },

  {
    label: "Customers",
    icon: Users,
    items: [
      { label: "All Customers", href: "/admin/customers" },
      { label: "Customer Detail", href: "/admin/customers/detail" },
      { label: "Order History", href: "/admin/customers/order-history" },
      { label: "Customer Segments", href: "/admin/customers/segments" },
      { label: "Customer Export", href: "/admin/customers/export" },
    ],
  },

  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { label: "Coupons", href: "/admin/marketing/coupons" },
      { label: "Promotions", href: "/admin/marketing/promotions" },
      { label: "Campaigns", href: "/admin/marketing/campaigns" },
      { label: "Gift Cards", href: "/admin/marketing/gift-cards" },
    ],
  },

  {
    label: "Analytics",
    icon: BarChart3,
    items: [
      { label: "Sales", href: "/admin/analytics/sales" },
      { label: "Products", href: "/admin/analytics/products" },
      { label: "Customers", href: "/admin/analytics/customers" },
      { label: "Inventory", href: "/admin/analytics/inventory" },
      { label: "Orders", href: "/admin/analytics/orders" },
      { label: "Marketing", href: "/admin/analytics/marketing" },
    ],
  },

  {
    label: "Fulfillment",
    icon: Truck,
    items: [
      { label: "Shipments", href: "/admin/fulfillment/shipments" },
      { label: "Shipping Methods", href: "/admin/fulfillment/shipping-methods" },
      { label: "Tracking", href: "/admin/fulfillment/tracking" },
      { label: "Delivery Status", href: "/admin/fulfillment/delivery-status" },
    ],
  },

  {
    label: "Finance",
    icon: CreditCard,
    items: [
      { label: "Revenue", href: "/admin/finance/revenue" },
      { label: "Payments", href: "/admin/finance/payments" },
      { label: "Refunds", href: "/admin/finance/refunds" },
      { label: "Taxes", href: "/admin/finance/taxes" },
      { label: "Transaction History", href: "/admin/finance/transactions" },
    ],
  },

  {
    label: "Content",
    icon: Palette,
    items: [
      { label: "Homepage", href: "/admin/content/homepage" },
      { label: "Banners", href: "/admin/content/banners" },
      { label: "Lookbook", href: "/admin/content/lookbook" },
      { label: "Editorial", href: "/admin/content/editorial" },
      { label: "Media Library", href: "/admin/content/media" },
    ],
  },

  {
    label: "Settings",
    icon: Settings,
    items: [
      { label: "Store", href: "/admin/settings/store" },
      { label: "Admin Users", href: "/admin/settings/admin-users" },
      { label: "Roles & Permissions", href: "/admin/settings/roles" },
      { label: "Payment", href: "/admin/settings/payment" },
      { label: "Shipping", href: "/admin/settings/shipping" },
      { label: "Tax", href: "/admin/settings/tax" },
      { label: "Notifications", href: "/admin/settings/notifications" },
      { label: "General", href: "/admin/settings/general" },
    ],
  },
];

export default function AdminSidebar({
  onNavigate,
}: AdminSidebarProps) {
  const [openGroup, setOpenGroup] = useState("Dashboard");

  return (
    <aside className="flex h-full w-72 flex-col border-r border-neutral-200 bg-white">
      {/* Brand */}
      <div className="flex h-20 shrink-0 items-center border-b border-neutral-200 px-6">
        <div>
          <div className="text-xl font-semibold tracking-[0.25em]">
            KONO
          </div>

          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
            Administration
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {menuGroups.map((group) => {
            const Icon = group.icon;
            const isOpen = openGroup === group.label;

            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup(isOpen ? "" : group.label)
                  }
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    <span>{group.label}</span>
                  </span>

                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={1.8}
                  />
                </button>

                {isOpen && (
                  <div className="ml-4 border-l border-neutral-200 py-1 pl-3">
                    {group.items.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`block rounded-md px-3 py-2 text-sm transition ${
                          item.href === "/admin"
                            ? "bg-neutral-100 font-medium text-neutral-950"
                            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950"
                        }`}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-neutral-200 p-4">
        <div className="rounded-lg bg-neutral-50 px-3 py-3">
          <div className="text-xs font-medium text-neutral-900">
            KONO Admin
          </div>

          <div className="mt-1 text-[11px] text-neutral-400">
            Administration Panel
          </div>
        </div>
      </div>
    </aside>
  );
}