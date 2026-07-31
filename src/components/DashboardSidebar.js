"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Archive, MapPin, Map, ClipboardList, Users, MessageSquare,
  LineChart, Search, Menu, X, Bell, Megaphone, BarChart3, BadgeCheck,
} from "lucide-react";

/**
 * Role-aware navigation, grouped rather than a long flat list.
 * Hidden navigation is not authorization — the proxy guard and API handlers
 * enforce role rules independently.
 */
const NAV_GROUPS = {
  Admin: [
    { title: null, items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
    {
      title: "Records",
      items: [
        { label: "Graves", href: "/dashboard/graves", icon: Archive },
        { label: "Verification", href: "/dashboard/verification", icon: BadgeCheck },
      ],
    },
    {
      title: "Layout",
      items: [
        { label: "Plots", href: "/dashboard/plots", icon: MapPin },
        { label: "Locations", href: "/dashboard/locations", icon: Map },
        { label: "Map", href: "/dashboard/map", icon: Map },
      ],
    },
    {
      title: "Service",
      items: [
        { label: "Requests", href: "/dashboard/requests", icon: ClipboardList },
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
        { label: "Broadcasts", href: "/dashboard/broadcasts", icon: Megaphone },
        { label: "Feedback", href: "/dashboard/feedback", icon: MessageSquare },
      ],
    },
    {
      title: "Insight",
      items: [
        { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
        { label: "Reports", href: "/dashboard/reports", icon: LineChart },
      ],
    },
    { title: "Administration", items: [{ label: "Users", href: "/dashboard/users", icon: Users }] },
  ],
  Staff: [
    { title: null, items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
    {
      title: "Records",
      items: [
        { label: "Graves", href: "/dashboard/graves", icon: Archive },
        { label: "Verification", href: "/dashboard/verification", icon: BadgeCheck },
      ],
    },
    {
      title: "Layout",
      items: [
        { label: "Plots", href: "/dashboard/plots", icon: MapPin },
        { label: "Map", href: "/dashboard/map", icon: Map },
      ],
    },
    {
      title: "Service",
      items: [
        { label: "Requests", href: "/dashboard/requests", icon: ClipboardList },
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
        { label: "Feedback", href: "/dashboard/feedback", icon: MessageSquare },
      ],
    },
  ],
  Client: [
    { title: null, items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
    {
      title: "Find a grave",
      items: [
        { label: "Search", href: "/dashboard/search", icon: Search },
        { label: "Map", href: "/dashboard/map", icon: Map },
      ],
    },
    {
      title: "My activity",
      items: [
        { label: "My Requests", href: "/dashboard/requests", icon: ClipboardList },
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
        { label: "Feedback", href: "/dashboard/feedback", icon: MessageSquare },
      ],
    },
  ],
};

export default function DashboardSidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);

  // Only render role navigation once the session resolves, so a Client menu
  // never flashes for an Admin/Staff user.
  const resolved = status !== "loading";
  const role = session?.user?.role || "Client";
  const groups = resolved ? NAV_GROUPS[role] || NAV_GROUPS.Client : [];

  // Drawer accessibility: Escape to close, focus containment, focus return,
  // and body-scroll lock while open.
  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const toggleButton = toggleRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll('a[href], button:not([disabled])') || []
      );
    focusables()[0]?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = focusables();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      else toggleButton?.focus();
    };
  }, [mobileOpen]);

  // Staff and Client users use top secondary sub-navigation bar instead of vertical left sidebar
  if (role === "Staff" || role === "Client") {
    return null;
  }

  return (
    <>
      <div
        className={`sidebar-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <button
        ref={toggleRef}
        className="menu-toggle"
        onClick={() => setMobileOpen((open) => !open)}
        style={{ position: "fixed", top: "1rem", left: "1rem", zIndex: 200 }}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        aria-controls="dashboard-sidebar"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside
        id="dashboard-sidebar"
        ref={sidebarRef}
        className={`sidebar ${mobileOpen ? "open" : ""}`}
        aria-label="Dashboard navigation"
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand-text">Bolonsori Public Cemetery</div>
        </div>

        <nav className="sidebar-nav">
          {!resolved ? (
            <div className="sidebar-skeleton" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, index) => (
                <span key={index} className="sidebar-skeleton-row" />
              ))}
              <span className="sr-only">Loading navigation</span>
            </div>
          ) : (
            groups.map((group, groupIndex) => (
              <div key={group.title || `group-${groupIndex}`} className="sidebar-group">
                {group.title && <div className="sidebar-section-title">{group.title}</div>}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="sidebar-link-icon"><Icon size={18} /></span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </nav>
      </aside>
    </>
  );
}
