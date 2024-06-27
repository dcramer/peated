import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.ensureData(Number(entityId));

  return [
    {
      title: `Tastings for ${entity.name}`,
    },
  ];
}

export default async function EntityTastings({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const tastingList = await trpcClient.tastingList.ensureData({
    entity: Number(entityId),
  });

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} noBottle />
      ) : (
        <EmptyActivity href={`/search?tasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="mt-2 block font-light">
            Looks like no ones recorded any related spirit. You could be the
            first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
