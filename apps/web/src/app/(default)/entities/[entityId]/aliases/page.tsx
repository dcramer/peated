import Chip from "@peated/web/components/chip";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  return {
    title: `Other Names for ${entity.name}`,
  };
}

export default async function EntityAliases({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const [entity, aliasList] = await Promise.all([
    trpcClient.entityById.fetch(Number(entityId)),
    trpcClient.entityAliasList.fetch({
      entity: Number(entityId),
    }),
  ]);

  return (
    <div className="w-full p-3 lg:py-0">
      {aliasList.results.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {aliasList.results.map((alias) => {
            return (
              <li key={alias.name} className="flex items-center gap-2">
                <div>{alias.name}</div>
                {alias.name === entity.name && (
                  <Chip as="div" size="small" color="highlight">
                    Canonical
                  </Chip>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-center text-sm">
          No aliases found. This is a bug!
        </p>
      )}
    </div>
  );
}
