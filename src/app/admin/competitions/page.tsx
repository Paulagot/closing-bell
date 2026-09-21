import CompetitionManagerClient from "@/components/competitions/CompetitionManagerClient";
import { requireCompetitionAdminPage } from "@/lib/competitions/adminPage";

export default function CompetitionAdminPage() {
  requireCompetitionAdminPage(
    "/admin/competitions"
  );

  return <CompetitionManagerClient />;
}
