import { getBottlePage } from "@peated/web/lib/bottlePage.server";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const params = await props.params;

  const { bottleId } = params;

  const bottle = await getBottlePage(Number(bottleId));

  return {
    title: `Bottlings of ${bottle.fullName}`,
    description: `Known bottlings of ${bottle.fullName}, including optional exact picks and single casks.`,
  };
}
