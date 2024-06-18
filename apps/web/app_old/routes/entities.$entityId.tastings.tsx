import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { entityId }, context: { queryUtils } }) => {
    invariant(entityId);

    return {
      tastingList: await queryUtils.tastingList.ensureData({
        entity: Number(entityId),
      }),
    };
  },
);

export default function EntityActivity() {
  const { tastingList } = useLoaderData<typeof loader>();

  if (!tastingList) return null;

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} />
      ) : (
        <EmptyActivity to={`/search?tasting`}>
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
