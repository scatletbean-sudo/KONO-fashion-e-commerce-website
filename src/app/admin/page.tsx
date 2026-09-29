import { dashboardService } from "@/features/dashboard/services/dashboard.service";
import DashboardOverview from "@/components/admin/dashboard/DashboardOverview";

export default async function AdminPage() {
  const overview = await dashboardService.getOverview();

  return <DashboardOverview initialOverview={overview} />;
}