import Chip from "@peated/web/components/chip";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { getBottle } from "../../utils.server";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const bottle = await getBottle(Number(bottleId));

  return [
    {
      title: `Aliases for ${bottle.fullName}`,
    },
  ];
}

export default async function BottleAliases({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const [bottle, aliasList] = await Promise.all([
    getBottle(Number(bottleId)),
    trpcClient.bottleAliasList.query({
      bottle: Number(bottleId),
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
                {alias.name === bottle.fullName && (
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
