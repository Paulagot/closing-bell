import CompetitionLeaderboardPageClient from "@/components/competitions/CompetitionLeaderboardPageClient";

interface Props {
  params: {
    slug: string;
  };
}

export default function CompetitionLeaderboardPage({
  params,
}: Props) {
  return (
    <CompetitionLeaderboardPageClient
      slug={params.slug}
    />
  );
}
