import AdminStocksPageClient from "@/components/admin/AdminStocksPageClient";
import { requireCompetitionAdminPage } from "@/lib/competitions/adminPage";

export default function AdminStocksPage() {
  requireCompetitionAdminPage(
    "/admin/stocks"
  );

  return <AdminStocksPageClient />;
}
