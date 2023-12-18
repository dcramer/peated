import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { useLoaderData, useParams } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { bottleId }, context: { trpc } }) => {
    invariant(bottleId);

    const tastingList = await trpc.tastingList.query({
      bottle: Number(bottleId),
    });

    return json({ tastingList });
  },
);

export default function BottleActivity() {
  const { bottleId } = useParams<"bottleId">();
  const { tastingList } = useLoaderData<typeof loader>();

  invariant(bottleId);

  if (!tastingList) return null;

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} noBottle />
      ) : (
        <EmptyActivity to={`/bottles/${bottleId}/addTasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="mt-2 block font-light">
            Looks like no ones recorded this spirit. You could be the first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
