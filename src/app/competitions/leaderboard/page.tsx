import CompetitionLeaderboardPageClient from "@/components/competitions/CompetitionLeaderboardPageClient";
import { getActiveCompetitionSlug } from "@/lib/competitions/storage";

export default async function ActiveCompetitionLeaderboardPage() {
  const slug =
    await getActiveCompetitionSlug();

  return (
    <CompetitionLeaderboardPageClient
      slug={slug}
    />
  );
}
