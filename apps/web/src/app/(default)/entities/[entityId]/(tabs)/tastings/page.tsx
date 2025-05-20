import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { getServerClient } from "@peated/web/lib/orpc/client.server";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const client = await getServerClient();

  const entity = await client.entities.details({
    entity: Number(entityId),
  });

  return {
    title: `Tastings for ${entity.name}`,
  };
}

export default async function EntityTastings({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const client = await getServerClient();

  const tastingList = await client.tastings.list({
    entity: Number(entityId),
  });

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} />
      ) : (
        <EmptyActivity href={`/search?tasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="font-muted mt-2 block">
            Looks like no ones recorded any related spirit. You could be the
            first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
