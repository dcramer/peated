import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import BottleHeader from "../components/bottleHeader";
import Chip from "../components/chip";
import Layout from "../components/layout";
import Tabs from "../components/tabs";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params, context: { queryUtils } }) => {
    invariant(params.bottleId);

    const bottleId = Number(params.bottleId);

    const [aliasList, bottle] = await Promise.all([
      queryUtils.bottleAliasList.ensureData({
        bottle: bottleId,
      }),
      queryUtils.bottleById.ensureData(bottleId),
    ]);
    return { aliasList, bottle };
  },
);

export default function BottleAliases() {
  const { aliasList, bottle } = useLoaderData<typeof loader>();

  if (!aliasList) return null;

  return (
    <Layout>
      <div className="w-full p-3 lg:py-0">
        <BottleHeader bottle={bottle} />
        <Tabs fullWidth border>
          <Tabs.Item active>Aliases</Tabs.Item>
        </Tabs>
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
    </Layout>
  );
}
