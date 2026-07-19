import Providers from "@/components/Providers";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";

export const metadata = {
  title: "Dashboard — Smart Cemetery",
  description: "Manage cemetery records, plots, and navigation",
};

export default function DashboardLayout({ children }) {
  return (
    <Providers>
      <div className="app-layout">
        <DashboardSidebar />
        <main className="main-content">
          <DashboardHeader />
          <div className="page-content">{children}</div>
        </main>
      </div>
    </Providers>
  );
}
