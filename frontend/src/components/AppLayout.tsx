"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Sprout, LayoutDashboard, Map, Satellite,
  Brain, HelpCircle, LogOut, ChevronRight, Menu, X,
  UserCircle
} from "lucide-react";

import { useUserStore } from "@/lib/stores/farmStore";
import { logout } from "@/lib/auth/auth-client";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/farms", icon: Map, label: "My Farms" },
  { href: "/satellite", icon: Satellite, label: "Satellite" },
  { href: "/ai-chat", icon: Brain, label: "KrishiBot AI" },
  { href: "/profile", icon: UserCircle, label: "Profile" },
  { href: "/help", icon: HelpCircle, label: "Help" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useUserStore();

  return (
    <div className="min-h-screen flex">
      <div className="fixed inset-0 z-[1] pointer-events-none select-none bg-farm-gray">
        <Image
          src="/images/field_satellite.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/25 to-white/45" />
      </div>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-white/85 backdrop-blur-md border-r border-farm-border-color flex flex-col transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-farm-border-color flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 group" title="Return to Homepage">
            <div className="w-8 h-8 bg-farm-green rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sprout className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-farm-dark text-base tracking-tight">
              Fasal<span className="text-farm-green">Setu</span>
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-farm-green text-white shadow-sm"
                    : "text-farm-muted hover:bg-farm-green-light hover:text-farm-green"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-farm-border-color">
          <Link href="/profile" className="flex items-center gap-3 mb-3 group" onClick={() => setSidebarOpen(false)}>
            <div className="w-8 h-8 rounded-full bg-farm-green flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0">
              {profile.name ? profile.name.charAt(0) : "F"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-farm-dark truncate group-hover:text-farm-green transition-colors">{profile.name || "Farmer Account"}</p>
              <p className="text-xs text-farm-muted">{profile.state || "India"}</p>
            </div>
          </Link>
          <Link
            href="/login"
            onClick={logout}
            className="flex items-center gap-2 text-xs text-farm-muted hover:text-red-500 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </Link>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-60">
        {/* Topbar */}
        <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-farm-border-color flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-20">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-farm-green-light text-farm-dark transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo / Home redirect in topbar */}
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            title="Return to Homepage"
          >
            <div className="w-7 h-7 bg-farm-green rounded-lg flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Sprout className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-farm-dark text-base tracking-tight">
              Fasal<span className="text-farm-green">Setu</span>
            </span>
          </Link>

          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
