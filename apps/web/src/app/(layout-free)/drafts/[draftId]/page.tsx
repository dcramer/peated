import TastingDraftFlow from "./tastingDraftFlow";

export default async function TastingDraftPage(props: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await props.params;

  return <TastingDraftFlow draftId={draftId} />;
}
