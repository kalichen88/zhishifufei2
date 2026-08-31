import { ContentDetailClient } from "./content-detail-client";

export default async function ContentDetailPage({
  params
}: {
  params: Promise<{ cloudVid: string }>;
}) {
  const resolvedParams = await params;

  return (
    <main style={{ padding: 24 }}>
      <ContentDetailClient cloudVid={decodeURIComponent(resolvedParams.cloudVid)} />
    </main>
  );
}
