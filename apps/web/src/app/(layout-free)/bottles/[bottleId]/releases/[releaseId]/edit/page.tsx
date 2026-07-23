import { permanentRedirect } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ bottleId: string; releaseId: string }>;
}) {
  const params = await props.params;

  const { bottleId, releaseId } = params;

  permanentRedirect(`/bottles/${bottleId}/bottlings/${releaseId}/edit`);
}
