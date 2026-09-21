import CompetitionPageClient from "@/components/competitions/CompetitionPageClient";
import { getActiveCompetitionSlug } from "@/lib/competitions/storage";

export default async function CompetitionsPage() {
  const slug =
    await getActiveCompetitionSlug();

  return (
    <CompetitionPageClient
      slug={slug}
    />
  );
}
