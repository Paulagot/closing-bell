import PaperLabClient from "@/components/paperLab/PaperLabClient";
import { requireCompetitionAdminPage } from "@/lib/competitions/adminPage";

export default function PaperLabPage() {
  requireCompetitionAdminPage("/admin/lab");
  return <PaperLabClient />;
}
