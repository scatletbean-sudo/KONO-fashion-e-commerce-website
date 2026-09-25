"use client";

import {
  Bell,
  Menu,
  Search,
} from "lucide-react";

type AdminHeaderProps = {
  onMenuClick?: () => void;
};

export default function AdminHeader({
  onMenuClick,
}: AdminHeaderProps) {
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
          <Menu className="h-5 w-5" strokeWidth={1.8} />
        </button>

        <div className="hidden sm:block">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            Administration
          </p>

          <h1 className="mt-1 text-lg font-medium tracking-tight text-neutral-950">
            Dashboard
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
          <Search className="h-4 w-4" strokeWidth={1.8} />

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
          <Bell className="h-5 w-5" strokeWidth={1.8} />

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