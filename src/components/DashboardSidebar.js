"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Archive, MapPin, Map, ClipboardList, Users, MessageSquare, LineChart, Search, Menu, Landmark, Bell, Megaphone, BarChart3, BadgeCheck } from "lucide-react";

const adminNav = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "Graves", href: "/dashboard/graves", icon: <Archive size={18} /> },
  { label: "Plots", href: "/dashboard/plots", icon: <MapPin size={18} /> },
  { label: "Locations", href: "/dashboard/locations", icon: <Map size={18} /> },
  { label: "Map", href: "/dashboard/map", icon: <Map size={18} /> },
  { label: "Requests", href: "/dashboard/requests", icon: <ClipboardList size={18} /> },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell size={18} /> },
  { label: "Broadcasts", href: "/dashboard/broadcasts", icon: <Megaphone size={18} /> },
  { label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 size={18} /> },
  { label: "Verification", href: "/dashboard/verification", icon: <BadgeCheck size={18} /> },
  { label: "Users", href: "/dashboard/users", icon: <Users size={18} /> },
  { label: "Feedback", href: "/dashboard/feedback", icon: <MessageSquare size={18} /> },
  { label: "Reports", href: "/dashboard/reports", icon: <LineChart size={18} /> },
];

const staffNav = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "Graves", href: "/dashboard/graves", icon: <Archive size={18} /> },
  { label: "Plots", href: "/dashboard/plots", icon: <MapPin size={18} /> },
  { label: "Map", href: "/dashboard/map", icon: <Map size={18} /> },
  { label: "Requests", href: "/dashboard/requests", icon: <ClipboardList size={18} /> },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell size={18} /> },
  { label: "Verification", href: "/dashboard/verification", icon: <BadgeCheck size={18} /> },
  { label: "Feedback", href: "/dashboard/feedback", icon: <MessageSquare size={18} /> },
];

const clientNav = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "Search", href: "/dashboard/search", icon: <Search size={18} /> },
  { label: "Map", href: "/dashboard/map", icon: <Map size={18} /> },
  { label: "My Requests", href: "/dashboard/requests", icon: <ClipboardList size={18} /> },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell size={18} /> },
  { label: "Feedback", href: "/dashboard/feedback", icon: <MessageSquare size={18} /> },
];

function getNavItems(role) {
  switch (role) {
    case "Admin": return adminNav;
    case "Staff": return staffNav;
    default: return clientNav;
  }
}

export default function DashboardSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = session?.user?.role || "Client";
  const navItems = getNavItems(role);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile toggle */}
      <button
        className="menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          position: "fixed",
          top: "1rem",
          left: "1rem",
          zIndex: 200,
        }}
        aria-label="Toggle navigation"
      >
        <Menu size={24} />
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div>
            <div className="sidebar-brand-text">Bolonsori Public Cemetery</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}

        </nav>
      </aside>
    </>
  );
}
