import CompetitionPageClient from "@/components/competitions/CompetitionPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CompetitionBySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <CompetitionPageClient
      slug={String(params.slug ?? "").trim()}
    />
  );
}