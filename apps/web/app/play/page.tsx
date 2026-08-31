import { PlayerClient } from "./player-client";

export default async function PlayPage({
  searchParams
}: {
  searchParams?: Promise<{ vid?: string }>;
}) {
  const params = await searchParams;
  const initialVid = params?.vid ?? "";

  return (
    <main style={{ padding: 24 }}>
      <PlayerClient initialVid={initialVid} />
    </main>
  );
}
