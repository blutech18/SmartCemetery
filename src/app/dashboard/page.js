"use client";

import { useSession } from "next-auth/react";
import { AdminDashboard } from "../../components/dashboard/AdminDashboard";
import { StaffDashboard } from "../../components/dashboard/StaffDashboard";
import { ClientDashboard } from "../../components/dashboard/ClientDashboard";
import { Skeleton } from "../../components/ui/Skeleton";

/**
 * Dashboard landing page — routes each role to its own workspace.
 * Every role now has a purpose-built dashboard scoped to what it may act on.
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-lg">
        <Skeleton style={{ height: "72px", width: "100%" }} />
        <div className="grid grid-4 gap-md">
          <Skeleton style={{ height: "120px" }} />
          <Skeleton style={{ height: "120px" }} />
          <Skeleton style={{ height: "120px" }} />
          <Skeleton style={{ height: "120px" }} />
        </div>
        <Skeleton style={{ height: "320px", width: "100%" }} />
      </div>
    );
  }

  const role = session?.user?.role || "Client";
  const userName = session?.user?.name;

  if (role === "Admin") return <AdminDashboard />;
  if (role === "Staff") return <StaffDashboard userName={userName} />;
  return <ClientDashboard userName={userName} />;
}
