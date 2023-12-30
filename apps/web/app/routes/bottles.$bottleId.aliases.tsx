import type { Bottle } from "@peated/server/types";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import Chip from "../components/chip";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { bottleId }, context: { trpc } }) => {
    invariant(bottleId);

    const aliasList = await trpc.bottleAliasList.query({
      bottle: Number(bottleId),
    });

    return json({ aliasList });
  },
);

export default function BottlePrices() {
  const { aliasList } = useLoaderData<typeof loader>();
  const { bottle } = useOutletContext<{ bottle: Bottle }>();

  if (!aliasList) return null;

  return (
    <div className="mt-6">
      {aliasList.results.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {aliasList.results.map((alias) => {
            return (
              <li key={alias.name} className="flex items-center gap-2">
                <div>{alias.name}</div>
                {alias.name === bottle.fullName && (
                  <Chip size="small" color="highlight">
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
