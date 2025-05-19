import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { client } from "@peated/web/lib/orpc/client";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const bottle = await client.bottles.details({
    bottle: Number(bottleId),
  });

  return {
    title: `Tastings for ${bottle.fullName}`,
  };
}

export default async function BottleTastings({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const tastingList = await client.tastings.list({
    bottle: Number(bottleId),
  });

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} noBottle />
      ) : (
        <EmptyActivity href={`/bottles/${bottleId}/addTasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="font-muted mt-2 block">
            Looks like no ones recorded this spirit. You could be the first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
