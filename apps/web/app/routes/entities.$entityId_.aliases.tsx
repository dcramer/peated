import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import Chip from "../components/chip";
import EntityHeader from "../components/entityHeader";
import Layout from "../components/layout";
import Tabs from "../components/tabs";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params, context: { queryUtils } }) => {
    invariant(params.entityId);

    const entityId = Number(params.entityId);

    const [aliasList, entity] = await Promise.all([
      queryUtils.entityAliasList.ensureData({
        entity: entityId,
      }),
      queryUtils.entityById.ensureData(entityId),
    ]);
    return { aliasList, entity };
  },
);

export default function EntityAliases() {
  const { aliasList, entity } = useLoaderData<typeof loader>();

  if (!aliasList) return null;

  return (
    <Layout>
      <div className="w-full p-3 lg:py-0">
        <EntityHeader entity={entity} />
        <Tabs fullWidth border>
          <Tabs.Item active>Aliases</Tabs.Item>
        </Tabs>
        {aliasList.results.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {aliasList.results.map((alias) => {
              return (
                <li key={alias.name} className="flex items-center gap-2">
                  <div>{alias.name}</div>
                  {alias.name === entity.name && (
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
