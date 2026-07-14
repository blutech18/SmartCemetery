"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Archive, MapPin, Map, ClipboardList, Users, MessageSquare, LineChart, Search, LogOut, Menu, Landmark, Bell } from "lucide-react";

const adminNav = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "Graves", href: "/dashboard/graves", icon: <Archive size={18} /> },
  { label: "Plots", href: "/dashboard/plots", icon: <MapPin size={18} /> },
  { label: "Locations", href: "/dashboard/locations", icon: <Map size={18} /> },
  { label: "Map", href: "/dashboard/map", icon: <Map size={18} /> },
  { label: "Requests", href: "/dashboard/requests", icon: <ClipboardList size={18} /> },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell size={18} /> },
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
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

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
          <div className="sidebar-brand-icon">
            <Landmark size={24} />
          </div>
          <div>
            <div className="sidebar-brand-text">Smart Cemetery</div>
            <div className="sidebar-brand-sub">Navigation Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Navigation</div>
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

          <div className="sidebar-section-title" style={{ marginTop: "auto" }}>
            Account
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="flex items-center gap-md" style={{ marginBottom: "0.75rem" }}>
            <div className="avatar">{initials}</div>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {session?.user?.name || "User"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {role}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm w-full flex items-center justify-center gap-xs"
            onClick={() => signOut({ callbackUrl: "/login" })}
            id="sidebar-logout"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
