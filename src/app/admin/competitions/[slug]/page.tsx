import CompetitionAdminPageClient from "@/components/competitions/CompetitionAdminPageClient";
import { requireCompetitionAdminPage } from "@/lib/competitions/adminPage";

export default function CompetitionAdminDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = String(params.slug ?? "").trim();

  requireCompetitionAdminPage(
    `/admin/competitions/${slug}`
  );

  return (
    <CompetitionAdminPageClient
      slug={slug}
    />
  );
}
